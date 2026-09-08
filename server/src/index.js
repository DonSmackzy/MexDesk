const { WebSocketServer, WebSocket } = require("ws");
const http = require("http");

const fs = require("fs");
const path = require("path");

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

// Create HTTP server for health checks, static assets & WebSocket upgrades
const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok", app: "MexDesk Server", peers: peers.size }));
  }

  if (fs.existsSync(DIST_DIR)) {
    let cleanUrl = req.url.split("?")[0];
    let filePath = path.join(DIST_DIR, cleanUrl === "/" ? "index.html" : cleanUrl);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
      return fs.createReadStream(filePath).pipe(res);
    }

    // SPA fallback to index.html
    const indexPath = path.join(DIST_DIR, "index.html");
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { "Content-Type": "text/html" });
      return fs.createReadStream(indexPath).pipe(res);
    }
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("MexDesk Signaling Server is running on port " + PORT);
});

const wss = new WebSocketServer({ server });

// Map of peerId -> { ws, id, alias, unattendedPassword, status: 'available'|'busy', sessionWith, systemInfo }
const peers = new Map();
const socketToPeerId = new Map();

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
  const peer = peers.get(peerId);
  if (peer && peer.ws) {
    sendTo(peer.ws, message);
    return true;
  }
  return false;
}

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

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
  const { type } = msg;

  switch (type) {
    case "register": {
      // Client requesting or re-claiming its permanent static device ID
      let assignedId = msg.requestedId ? normalizeId(msg.requestedId) : null;

      if (!assignedId) {
        assignedId = generateMexDeskId();
      } else {
        // If an existing socket is registered with this ID (e.g. fast browser refresh/reconnect)
        const existingPeer = peers.get(assignedId);
        if (existingPeer && existingPeer.ws !== ws) {
          try {
            existingPeer.ws.close();
          } catch (e) {}
          peers.delete(assignedId);
          socketToPeerId.delete(existingPeer.ws);
        }
      }

      const peerData = {
        ws,
        id: assignedId,
        alias: msg.alias || "MexDesk Device",
        unattendedPassword: msg.unattendedPassword || null,
        status: "available",
        sessionWith: null,
        systemInfo: msg.systemInfo || {}
      };

      peers.set(assignedId, peerData);
      socketToPeerId.set(ws, assignedId);

      sendTo(ws, {
        type: "registered",
        id: assignedId,
        alias: peerData.alias,
        hasUnattendedPassword: !!peerData.unattendedPassword
      });

      console.log(`[MexDesk Server] Registered peer: ${assignedId} (${peerData.alias})`);
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
      peer.alias = newAlias || `MexDesk Device`;

      sendTo(ws, {
        type: "alias-updated",
        alias: peer.alias,
        success: true
      });

      console.log(`[MexDesk Server] Alias updated for ${peerId}: "${peer.alias}"`);
      break;
    }

    case "set-unattended-password": {
      const peerId = socketToPeerId.get(ws);
      if (peerId && peers.has(peerId)) {
        peers.get(peerId).unattendedPassword = msg.password || null;
        sendTo(ws, {
          type: "unattended-password-updated",
          enabled: !!msg.password
        });
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
        sendTo(ws, {
          type: "query-peer-result",
          targetId: targetPeer.id,
          found: true,
          status: targetPeer.status,
          alias: targetPeer.alias,
          requiresPassword: !!targetPeer.unattendedPassword
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

      // Check unattended access password if provided
      if (targetPeer.unattendedPassword) {
        if (msg.password && msg.password === targetPeer.unattendedPassword) {
          // Auto-accept unattended connection!
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
        } else if (msg.password) {
          sendTo(ws, { type: "call-error", message: "Incorrect unattended access password." });
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
      sendToPeer(targetId, {
        type: "offer",
        senderId,
        sdp: msg.sdp
      });
      break;
    }

    case "answer": {
      const senderId = socketToPeerId.get(ws);
      const targetId = normalizeId(msg.targetId);
      sendToPeer(targetId, {
        type: "answer",
        senderId,
        sdp: msg.sdp
      });
      break;
    }

    case "ice-candidate": {
      const senderId = socketToPeerId.get(ws);
      const targetId = normalizeId(msg.targetId);
      sendToPeer(targetId, {
        type: "ice-candidate",
        senderId,
        candidate: msg.candidate
      });
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
