const { WebSocketServer, WebSocket } = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 7777;
const DIST_DIR = fs.existsSync(path.resolve(process.cwd(), "dist"))
  ? path.resolve(process.cwd(), "dist")
  : path.resolve(__dirname, "../../dist");

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".webm": "video/webm",
};

// Map of peerId -> { ws, id, alias, status: 'available'|'busy', sessionWith, systemInfo }
const peers = new Map();
const socketToPeerId = new Map();

// Device registry: deviceId -> { tokenHash, alias, passwordHash, passwordSalt, createdAt }
const deviceRegistry = new Map();
const REGISTRY_FILE = process.env.MEXDESK_REGISTRY_PATH || path.resolve(__dirname, "../registry.json");

function loadDeviceRegistry() {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      const data = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf-8"));
      for (const [id, record] of Object.entries(data)) {
        deviceRegistry.set(id, record);
      }
      console.log(`[MexDesk Server] Loaded ${deviceRegistry.size} persistent device registrations from disk.`);
    }
  } catch (err) {
    console.error("[MexDesk Server] Failed to load registry:", err.message);
  }
}

function persistDeviceRegistry() {
  try {
    const obj = {};
    for (const [id, record] of deviceRegistry.entries()) {
      obj[id] = record;
    }
    const tmpFile = `${REGISTRY_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(obj, null, 2), "utf-8");
    try {
      if (fs.existsSync(REGISTRY_FILE)) {
        fs.unlinkSync(REGISTRY_FILE);
      }
      fs.renameSync(tmpFile, REGISTRY_FILE);
    } catch {
      fs.copyFileSync(tmpFile, REGISTRY_FILE);
      try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
  } catch (err) {
    console.error("[MexDesk Server] Failed to persist registry:", err.message);
  }
}

// Load persisted registry at startup
loadDeviceRegistry();

// Brute-force protection: key (caller:target) -> { count, lockedUntil }
const authAttempts = new Map();

function hashAuthToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function verifyAuthToken(suppliedToken, storedHash) {
  if (!suppliedToken || !storedHash) return false;
  const suppliedHash = hashAuthToken(suppliedToken);
  const bufA = Buffer.from(suppliedHash);
  const bufB = Buffer.from(storedHash);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(suppliedPassword, storedHash, salt) {
  if (!suppliedPassword || !storedHash || !salt) return false;
  const testHash = hashPassword(suppliedPassword, salt);
  const bufA = Buffer.from(testHash);
  const bufB = Buffer.from(storedHash);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function checkRateLimit(key) {
  const now = Date.now();
  const attempt = authAttempts.get(key);
  if (attempt && attempt.lockedUntil > now) {
    const remainingSec = Math.ceil((attempt.lockedUntil - now) / 1000);
    return { allowed: false, remainingSec };
  }
  return { allowed: true };
}

function recordFailedAttempt(key) {
  const now = Date.now();
  const attempt = authAttempts.get(key) || { count: 0, lockedUntil: 0 };
  attempt.count++;
  if (attempt.count >= 5) {
    attempt.lockedUntil = now + 60000; // 60s lockout
    attempt.count = 0;
  }
  authAttempts.set(key, attempt);
}

function resetFailedAttempts(key) {
  authAttempts.delete(key);
}

// Create HTTP server for health checks, static assets & WebSocket upgrades
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff"
    });
    return res.end(JSON.stringify({ status: "ok", app: "MexDesk Server", peers: peers.size }));
  }

  if (fs.existsSync(DIST_DIR)) {
    let cleanUrl = req.url.split("?")[0];

    // Explicit traversal check: reject any URL attempting to use relative directory traversal
    let decodedUrl = cleanUrl;
    try {
      decodedUrl = decodeURIComponent(cleanUrl);
    } catch (e) {}

    if (cleanUrl.includes("..") || decodedUrl.includes("..")) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      return res.end("Forbidden: Path Traversal Detected");
    }

    if (cleanUrl === "/") cleanUrl = "/index.html";

    // Safe path containment check against path traversal
    const safePath = path.resolve(DIST_DIR, "." + path.normalize(cleanUrl));
    if (!safePath.startsWith(DIST_DIR)) {
      res.writeHead(403, { "Content-Type": "text/plain" });
      return res.end("Forbidden: Access Denied");
    }

    if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
      const ext = path.extname(safePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Referrer-Policy": "no-referrer"
      });
      const stream = fs.createReadStream(safePath);
      stream.on("error", () => {
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Internal Server Error");
        }
      });
      return stream.pipe(res);
    }

    // Do NOT fallback to index.html if the URL looks like a specific asset/file request (has extension)
    const hasExtension = path.extname(cleanUrl) !== "";
    if (hasExtension) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not Found");
    }

    // SPA fallback to index.html for navigation routes
    const indexPath = path.join(DIST_DIR, "index.html");
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, {
        "Content-Type": "text/html",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN"
      });
      const stream = fs.createReadStream(indexPath);
      stream.on("error", () => {
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Internal Server Error");
        }
      });
      return stream.pipe(res);
    }
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("MexDesk Signaling Server is running on port " + PORT);
});

// Configure WebSocket Server with 1MB maximum payload limit
const wss = new WebSocketServer({
  server,
  maxPayload: 1 * 1024 * 1024
});

function generateMexDeskId() {
  let id;
  do {
    const raw = Math.floor(100000000 + Math.random() * 900000000).toString();
    id = raw.replace(/(\d{3})(\d{3})(\d{3})/, "$1-$2-$3");
  } while (peers.has(id));
  return id;
}

function normalizeId(id) {
  if (!id) return "";
  const cleaned = id.toString().replace(/[^0-9]/g, "");
  if (cleaned.length === 9) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})/, "$1-$2-$3");
  }
  return id.trim();
}

function findPeer(query) {
  if (!query) return null;
  const q = query.toString().trim();
  const lower = q.toLowerCase();

  // 1. Direct ID match
  if (peers.has(q)) return peers.get(q);

  // 2. Normalized 9-digit format (e.g. 482901325 -> 482-901-325)
  const norm = normalizeId(q);
  if (peers.has(norm)) return peers.get(norm);

  // 3. Match alias (case-insensitive, e.g. "mezie@mex", "boss-mezie", "laptop")
  for (const peer of peers.values()) {
    if (peer.alias && peer.alias.toLowerCase() === lower) {
      return peer;
    }
  }
  return null;
}

function sendTo(ws, message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendToPeer(peerId, message) {
  const peer = findPeer(peerId);
  if (peer && peer.ws) {
    sendTo(peer.ws, message);
    return true;
  }
  return false;
}

function getSameLanPeers(clientIp, excludePeerId) {
  if (!clientIp) return [];
  const results = [];
  for (const peer of peers.values()) {
    if (peer.ip === clientIp && peer.id !== excludePeerId && !peer.optOutDiscovery) {
      results.push({
        id: peer.id,
        alias: peer.alias,
        status: peer.status,
        systemInfo: peer.systemInfo
      });
    }
  }
  return results;
}

function broadcastLanPeerEvent(clientIp, excludePeerId, eventPayload) {
  if (!clientIp) return;
  for (const peer of peers.values()) {
    if (peer.ip === clientIp && peer.id !== excludePeerId && !peer.optOutDiscovery) {
      sendTo(peer.ws, eventPayload);
    }
  }
}

wss.on("connection", (ws, req) => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  const rawIp = (req.headers["x-forwarded-for"]
    ? req.headers["x-forwarded-for"].split(",")[0].trim()
    : req.socket?.remoteAddress) || "";
  ws.clientIp = rawIp.replace(/^::ffff:/, ""); // Normalize IPv4-mapped IPv6

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      handleMessage(ws, msg);
    } catch (err) {
      console.error("[MexDesk Server] Failed to parse message:", err.message);
    }
  });

  ws.on("close", () => {
    const peerId = socketToPeerId.get(ws);
    if (peerId) {
      const peer = peers.get(peerId);
      if (peer && peer.sessionWith) {
        // Notify the active remote session partner
        sendToPeer(peer.sessionWith, {
          type: "peer-disconnected",
          peerId,
          reason: "Peer disconnected from network"
        });
        const partner = peers.get(peer.sessionWith);
        if (partner) {
          partner.status = "available";
          partner.sessionWith = null;
        }
      }
      if (peer && !peer.optOutDiscovery) {
        broadcastLanPeerEvent(peer.ip, peerId, {
          type: "lan-peer-left",
          peerId
        });
      }
      peers.delete(peerId);
      socketToPeerId.delete(ws);
      console.log(`[MexDesk Server] Peer left: ${peerId} (Total: ${peers.size})`);
    }
  });

  ws.on("error", (err) => {
    console.error("[MexDesk Server] WebSocket error:", err.message);
  });
});

function handleMessage(ws, msg) {
  try {
    const { type } = msg;

    switch (type) {
      case "register": {
        // Client requesting or re-claiming its permanent static device ID
        const requestedId = msg.requestedId ? normalizeId(msg.requestedId) : null;
        const suppliedToken = msg.authToken || null;
        let assignedId = null;
        let issuedToken = null;

        if (requestedId && deviceRegistry.has(requestedId)) {
          const regRecord = deviceRegistry.get(requestedId);
          // Verify token ownership to prevent ID hijacking
          if (suppliedToken && verifyAuthToken(suppliedToken, regRecord.tokenHash)) {
            assignedId = requestedId;
            issuedToken = suppliedToken;

            // Safely close stale connection from previous socket if different
            const existingPeer = peers.get(assignedId);
            if (existingPeer && existingPeer.ws !== ws) {
              try {
                existingPeer.ws.close(1000, "Replaced by authenticated owner reconnect");
              } catch (e) {}
              peers.delete(assignedId);
              socketToPeerId.delete(existingPeer.ws);
            }
          } else {
            // Ownership verification failed - reject hijacking and allocate fresh ID
            assignedId = generateMexDeskId();
            issuedToken = crypto.randomBytes(32).toString("hex");
            deviceRegistry.set(assignedId, {
              tokenHash: hashAuthToken(issuedToken),
              alias: msg.alias || "MexDesk Device",
              passwordHash: null,
              passwordSalt: null,
              createdAt: Date.now()
            });
            console.warn(`[MexDesk Server] Hijack attempt prevented for ID ${requestedId}. Re-assigned new ID: ${assignedId}`);
          }
        } else if (requestedId) {
          // ID not yet registered in registry - claim it with new token
          assignedId = requestedId;
          issuedToken = suppliedToken || crypto.randomBytes(32).toString("hex");
          deviceRegistry.set(assignedId, {
            tokenHash: hashAuthToken(issuedToken),
            alias: msg.alias || "MexDesk Device",
            passwordHash: null,
            passwordSalt: null,
            createdAt: Date.now()
          });
        } else {
          // Brand new device
          assignedId = generateMexDeskId();
          issuedToken = crypto.randomBytes(32).toString("hex");
          deviceRegistry.set(assignedId, {
            tokenHash: hashAuthToken(issuedToken),
            alias: msg.alias || "MexDesk Device",
            passwordHash: null,
            passwordSalt: null,
            createdAt: Date.now()
          });
        }

        const reg = deviceRegistry.get(assignedId);
        if (msg.unattendedPassword) {
          const salt = crypto.randomBytes(16).toString("hex");
          reg.passwordHash = hashPassword(msg.unattendedPassword, salt);
          reg.passwordSalt = salt;
        }
        if (msg.alias) {
          reg.alias = msg.alias;
        }

        const peerData = {
          ws,
          id: assignedId,
          alias: reg.alias,
          hasUnattendedPassword: !!reg.passwordHash,
          status: "available",
          sessionWith: null,
          systemInfo: msg.systemInfo || {},
          ip: ws.clientIp || "",
          optOutDiscovery: !!msg.optOutDiscovery
        };

        peers.set(assignedId, peerData);
        socketToPeerId.set(ws, assignedId);

        const sameLanPeers = getSameLanPeers(ws.clientIp, assignedId);

        sendTo(ws, {
          type: "registered",
          id: assignedId,
          alias: peerData.alias,
          authToken: issuedToken,
          hasUnattendedPassword: peerData.hasUnattendedPassword,
          lanPeers: sameLanPeers,
          optOutDiscovery: peerData.optOutDiscovery
        });

        // Broadcast to other peers on same local network
        if (!peerData.optOutDiscovery) {
          broadcastLanPeerEvent(peerData.ip, assignedId, {
            type: "lan-peer-joined",
            peer: {
              id: peerData.id,
              alias: peerData.alias,
              status: peerData.status,
              systemInfo: peerData.systemInfo
            }
          });
        }

        persistDeviceRegistry();
        console.log(`[MexDesk Server] Registered peer: ${assignedId} ("${peerData.alias}") [IP: ${peerData.ip || 'unknown'}]`);
        break;
      }

      case "set-alias": {
        const peerId = socketToPeerId.get(ws);
        const newAlias = (msg.alias || "").trim();

        if (!peerId || !peers.has(peerId)) {
          sendTo(ws, { type: "alias-error", message: "Device not registered." });
          break;
        }

        if (newAlias) {
          const existing = findPeer(newAlias);
          if (existing && existing.id !== peerId) {
            sendTo(ws, {
              type: "alias-error",
              message: `Alias "${newAlias}" is already taken by another desk.`
            });
            break;
          }
        }

        const peer = peers.get(peerId);
        peer.alias = newAlias || "MexDesk Device";

        const reg = deviceRegistry.get(peerId);
        if (reg) {
          reg.alias = peer.alias;
        }

        sendTo(ws, {
          type: "alias-updated",
          alias: peer.alias,
          success: true
        });

        if (!peer.optOutDiscovery) {
          broadcastLanPeerEvent(peer.ip, peerId, {
            type: "lan-peer-updated",
            peer: {
              id: peer.id,
              alias: peer.alias,
              status: peer.status
            }
          });
        }

        persistDeviceRegistry();
        console.log(`[MexDesk Server] Alias updated for ${peerId}: "${peer.alias}"`);
        break;
      }

      case "discover-lan": {
        const peerId = socketToPeerId.get(ws);
        const lanPeers = getSameLanPeers(ws.clientIp, peerId);
        sendTo(ws, {
          type: "lan-peers",
          peers: lanPeers
        });
        break;
      }

      case "set-discovery-pref": {
        const peerId = socketToPeerId.get(ws);
        if (peerId && peers.has(peerId)) {
          const peer = peers.get(peerId);
          const wasOptedOut = !!peer.optOutDiscovery;
          peer.optOutDiscovery = !!msg.optOutDiscovery;

          if (wasOptedOut && !peer.optOutDiscovery) {
            broadcastLanPeerEvent(peer.ip, peerId, {
              type: "lan-peer-joined",
              peer: {
                id: peer.id,
                alias: peer.alias,
                status: peer.status,
                systemInfo: peer.systemInfo
              }
            });
          } else if (!wasOptedOut && peer.optOutDiscovery) {
            broadcastLanPeerEvent(peer.ip, peerId, {
              type: "lan-peer-left",
              peerId
            });
          }

          sendTo(ws, {
            type: "discovery-pref-updated",
            optOutDiscovery: peer.optOutDiscovery
          });
        }
        break;
      }

      case "set-unattended-password": {
        const peerId = socketToPeerId.get(ws);
        if (peerId && deviceRegistry.has(peerId)) {
          const reg = deviceRegistry.get(peerId);
          if (msg.password) {
            const salt = crypto.randomBytes(16).toString("hex");
            reg.passwordHash = hashPassword(msg.password, salt);
            reg.passwordSalt = salt;
          } else {
            reg.passwordHash = null;
            reg.passwordSalt = null;
          }

          const peer = peers.get(peerId);
          if (peer) {
            peer.hasUnattendedPassword = !!reg.passwordHash;
          }

          sendTo(ws, {
            type: "unattended-password-updated",
            enabled: !!reg.passwordHash
          });
          persistDeviceRegistry();
          console.log(`[MexDesk Server] Unattended password updated for ${peerId}: ${!!reg.passwordHash ? "ENABLED" : "DISABLED"}`);
        }
        break;
      }

      case "query-peer": {
        const targetPeer = findPeer(msg.targetId);
        if (!targetPeer) {
          sendTo(ws, {
            type: "query-peer-result",
            targetId: msg.targetId,
            found: false
          });
        } else {
          const reg = deviceRegistry.get(targetPeer.id);
          sendTo(ws, {
            type: "query-peer-result",
            targetId: targetPeer.id,
            found: true,
            status: targetPeer.status,
            alias: targetPeer.alias,
            requiresPassword: reg ? !!reg.passwordHash : false
          });
        }
        break;
      }

      case "call-user": {
        const callerId = socketToPeerId.get(ws);
        const queryTarget = msg.targetId;

        if (!callerId) {
          sendTo(ws, { type: "call-error", message: "You are not registered." });
          return;
        }

        const targetPeer = findPeer(queryTarget);
        if (!targetPeer) {
          sendTo(ws, { type: "call-error", message: `Desk or Alias "${queryTarget}" is offline or not found.` });
          return;
        }

        const targetId = targetPeer.id;

        if (callerId === targetId) {
          sendTo(ws, { type: "call-error", message: "Cannot connect to your own MexDesk ID or alias." });
          return;
        }

        if (targetPeer.status === "busy") {
          sendTo(ws, { type: "call-error", message: `Desk "${targetPeer.alias || targetId}" is currently in another session.` });
          return;
        }

        const targetReg = deviceRegistry.get(targetId);

        // Check unattended access password if target configured one
        if (targetReg && targetReg.passwordHash) {
          const rateLimitKey = `${callerId}:${targetId}`;
          const rateLimit = checkRateLimit(rateLimitKey);

          if (!rateLimit.allowed) {
            sendTo(ws, {
              type: "call-error",
              message: `Too many failed password attempts. Locked out for ${rateLimit.remainingSec}s.`
            });
            return;
          }

          if (msg.password) {
            const isValid = verifyPassword(msg.password, targetReg.passwordHash, targetReg.passwordSalt);
            if (isValid) {
              resetFailedAttempts(rateLimitKey);

              // Auto-accept unattended connection
              targetPeer.status = "busy";
              targetPeer.sessionWith = callerId;

              const caller = peers.get(callerId);
              if (caller) {
                caller.status = "busy";
                caller.sessionWith = targetId;
              }

              sendTo(ws, {
                type: "call-accepted",
                targetId,
                targetAlias: targetPeer.alias,
                mode: "unattended",
                permissions: {
                  control: true,
                  fileTransfer: true,
                  clipboard: true,
                  audio: true
                }
              });

              sendTo(targetPeer.ws, {
                type: "unattended-session-started",
                callerId,
                callerAlias: msg.callerAlias || "Remote User"
              });

              console.log(`[MexDesk Server] Unattended session authorized: ${callerId} -> ${targetId}`);
              return;
            } else {
              recordFailedAttempt(rateLimitKey);
              sendTo(ws, { type: "call-error", message: "Incorrect unattended access password." });
              return;
            }
          } else {
            // Desk requires password, but caller did not supply one yet
            sendTo(ws, {
              type: "password-required",
              targetId,
              targetAlias: targetPeer.alias,
              message: "This desk requires an unattended access password."
            });
            return;
          }
        }

        // Standard interactive incoming call prompt
        sendTo(targetPeer.ws, {
          type: "incoming-call",
          callerId,
          callerAlias: msg.callerAlias || "MexDesk User",
          connectionType: msg.connectionType || "full-control"
        });

        sendTo(ws, {
          type: "call-ringing",
          targetId
        });

        console.log(`[MexDesk Server] Calling: ${callerId} -> ${targetId}`);
        break;
      }

      case "accept-call": {
        const hostId = socketToPeerId.get(ws);
        const callerId = normalizeId(msg.callerId);

        const caller = peers.get(callerId);
        const host = peers.get(hostId);

        if (!caller || !host) {
          sendTo(ws, { type: "call-error", message: "Peer no longer available." });
          return;
        }

        host.status = "busy";
        host.sessionWith = callerId;
        caller.status = "busy";
        caller.sessionWith = hostId;

        sendTo(caller.ws, {
          type: "call-accepted",
          targetId: hostId,
          targetAlias: host.alias,
          mode: "interactive",
          permissions: msg.permissions || {
            control: true,
            fileTransfer: true,
            clipboard: true,
            audio: true
          }
        });

        sendTo(ws, {
          type: "session-established",
          peerId: callerId,
          peerAlias: caller.alias,
          permissions: msg.permissions
        });

        console.log(`[MexDesk Server] Session accepted: ${callerId} <-> ${hostId}`);
        break;
      }

      case "reject-call": {
        const hostId = socketToPeerId.get(ws);
        const callerId = normalizeId(msg.callerId);
        sendToPeer(callerId, {
          type: "call-rejected",
          hostId,
          reason: msg.reason || "Connection rejected by remote desk."
        });
        break;
      }

      case "offer": {
        const senderId = socketToPeerId.get(ws);
        const targetId = normalizeId(msg.targetId);
        const sender = peers.get(senderId);

        // Security check: only relay if sender is in an active or establishing session
        if (sender && (sender.sessionWith === targetId || sender.status === "busy")) {
          sendToPeer(targetId, {
            type: "offer",
            senderId,
            sdp: msg.sdp
          });
        } else {
          console.warn(`[MexDesk Server] Blocked unauthorized offer from ${senderId} to ${targetId}`);
        }
        break;
      }

      case "answer": {
        const senderId = socketToPeerId.get(ws);
        const targetId = normalizeId(msg.targetId);
        const sender = peers.get(senderId);

        if (sender && (sender.sessionWith === targetId || sender.status === "busy")) {
          sendToPeer(targetId, {
            type: "answer",
            senderId,
            sdp: msg.sdp
          });
        } else {
          console.warn(`[MexDesk Server] Blocked unauthorized answer from ${senderId} to ${targetId}`);
        }
        break;
      }

      case "ice-candidate": {
        const senderId = socketToPeerId.get(ws);
        const targetId = normalizeId(msg.targetId);
        const sender = peers.get(senderId);

        if (sender && (sender.sessionWith === targetId || sender.status === "busy")) {
          sendToPeer(targetId, {
            type: "ice-candidate",
            senderId,
            candidate: msg.candidate
          });
        } else {
          console.warn(`[MexDesk Server] Blocked unauthorized ice-candidate from ${senderId} to ${targetId}`);
        }
        break;
      }

      case "hangup": {
        const senderId = socketToPeerId.get(ws);
        const sender = peers.get(senderId);
        if (sender && sender.sessionWith) {
          const partnerId = sender.sessionWith;
          sendToPeer(partnerId, {
            type: "session-ended",
            peerId: senderId,
            reason: msg.reason || "Remote user closed the session"
          });
          const partner = peers.get(partnerId);
          if (partner) {
            partner.status = "available";
            partner.sessionWith = null;
          }
          sender.status = "available";
          sender.sessionWith = null;
          console.log(`[MexDesk Server] Session ended between ${senderId} and ${partnerId}`);
        }
        break;
      }

      case "ping": {
        sendTo(ws, { type: "pong", timestamp: Date.now() });
        break;
      }

      default:
        console.warn("[MexDesk Server] Unhandled message type:", type);
    }
  } catch (err) {
    console.error("[MexDesk Server] Error in handleMessage:", err.message, err.stack);
    sendTo(ws, { type: "server-error", message: "An internal server error occurred." });
  }
}

// Keepalive interval: ping peers every 30s
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on("close", () => {
  clearInterval(interval);
});

server.listen(PORT, () => {
  console.log("==================================================");
  console.log("             MEXDESK SIGNALING SERVER             ");
  console.log(`  Port: ${PORT} | Status: Ready for WebRTC relay `);
  console.log("==================================================");
});
