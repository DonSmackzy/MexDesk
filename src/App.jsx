import React, { useState, useEffect, useRef, useCallback } from "react";
import { TitleBar } from "./components/TitleBar";
import { HomeScreen } from "./components/HomeScreen";
import { RemoteViewer } from "./components/RemoteViewer";
import { IncomingCallModal } from "./components/IncomingCallModal";
import { SettingsModal } from "./components/SettingsModal";
import { SignalingClient } from "./services/SignalingClient";
import { WebRTCConnection } from "./services/WebRTCConnection";
import AegisLogo from "./components/AegisLogo";
import { auditLogger } from "./services/AuditLogger";
import {
  Lock,
  ArrowRight,
  X,
  AlertCircle,
  Download,
  RefreshCw,
  MousePointer,
  FolderSync,
  Clipboard,
  Volume2,
  Shield,
  ShieldAlert,
  Pause,
  Play,
  Monitor,
  Check,
} from "lucide-react";

function getOrCreateStaticDeviceId() {
  let id = localStorage.getItem("mexdesk_device_static_id") || localStorage.getItem("mexdesk_my_id");
  if (!id || id.length < 9) {
    const raw = Math.floor(100000000 + Math.random() * 900000000).toString();
    id = raw.replace(/(\d{3})(\d{3})(\d{3})/, "$1-$2-$3");
    localStorage.setItem("mexdesk_device_static_id", id);
    localStorage.setItem("mexdesk_my_id", id);
  }
  return id;
}

export function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [myId, setMyId] = useState(() => getOrCreateStaticDeviceId());
  const [myAlias, setMyAlias] = useState(() => {
    const saved = localStorage.getItem("aegisdesk_my_alias") || localStorage.getItem("mexdesk_my_alias");
    if (saved === "MexDesk Device") {
      localStorage.setItem("aegisdesk_my_alias", "AegisDesk Device");
      return "AegisDesk Device";
    }
    return saved || "";
  });
  const [unattendedPassword, setUnattendedPassword] = useState(
    localStorage.getItem("mexdesk_unattended_pw") || ""
  );
  const CLOUD_SIGNALING = "wss://mexdesk.onrender.com";

  const urlParams = typeof window !== "undefined" && window.location?.search
    ? new URLSearchParams(window.location.search)
    : null;
  const queryServer = urlParams ? urlParams.get("server") : null;
  const queryConnect = urlParams ? (urlParams.get("connectTo") || "") : "";

  const getInitialSignalingUrl = () => {
    if (queryServer) return queryServer;
    const saved = localStorage.getItem("mexdesk_signaling_url");
    const isDev = window.location.protocol === "http:" && window.location.hostname === "localhost";
    if (isDev) return saved || "ws://localhost:7777";
    if (saved && !saved.includes("localhost") && !saved.includes("127.0.0.1")) return saved;
    if (window.location.protocol === "https:") return `wss://${window.location.host}`;
    return CLOUD_SIGNALING;
  };

  const [signalingUrl, setSignalingUrl] = useState(getInitialSignalingUrl);
  const [initialConnectTo] = useState(queryConnect);

  // ─── Multi-Session State ────────────────────────────────
  // sessions: { [peerId]: { id, alias, webrtc, stream, permissions, unreadChatCount, isCalling, connectionState, localStream, role } }
  const [sessions, setSessions] = useState({});
  const [activeTab, setActiveTab] = useState("home"); // "home" | peerId

  // Call modals
  const [incomingCall, setIncomingCall] = useState(null);
  const [isCallingModal, setIsCallingModal] = useState(false);
  const [callingTarget, setCallingTarget] = useState({ id: "", alias: "" });
  const [passwordChallenge, setPasswordChallenge] = useState(null);
  const [challengePasswordInput, setChallengePasswordInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Recent Sessions
  const [recentSessions, setRecentSessions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mexdesk_recent_sessions") || "[]");
    } catch {
      return [];
    }
  });

  // LAN Discovery & Presence
  const [lanPeers, setLanPeers] = useState([]);
  const [peerPresence, setPeerPresence] = useState({});
  const [optOutDiscovery, setOptOutDiscovery] = useState(
    () => localStorage.getItem("mexdesk_opt_out_discovery") === "true"
  );

  // Settings & Update
  const [showSettings, setShowSettings] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(null); // { version: string } | null
  const [updatePref, setUpdatePref] = useState(
    () => localStorage.getItem("aegisdesk_update_pref") || "prompt" // "auto" | "prompt"
  );

  // References
  const signalingRef = useRef(null);
  const startHostSessionRef = useRef(null);
  const hostPermissionsRef = useRef({});

  // ─── Session Helpers ────────────────────────────────────
  const updateSession = useCallback((peerId, patch) => {
    setSessions((prev) => {
      if (!prev[peerId]) return prev;
      return { ...prev, [peerId]: { ...prev[peerId], ...patch } };
    });
  }, []);

  const removeSession = useCallback((peerId) => {
    setSessions((prev) => {
      const next = { ...prev };
      const session = prev[peerId];
      const wasHost = session?.role === "host";

      // Log Session End in Audit Trail
      if (session) {
        const durationSec = Math.round((Date.now() - (session.startTime || Date.now())) / 1000);
        auditLogger.logSessionEnd(peerId, session.alias, durationSec);
      }

      // Cleanup WebRTC
      if (next[peerId]?.webrtc) {
        next[peerId].webrtc.close();
      }
      // Cleanup local stream
      if (next[peerId]?.localStream) {
        next[peerId].localStream.getTracks().forEach((t) => t.stop());
      }
      delete next[peerId];
      delete hostPermissionsRef.current[peerId];
      const remainingHostSessions = Object.values(next).some((s) => s.role === "host");
      if (!remainingHostSessions && window.mexdeskAPI?.updateSessionControlState) {
        window.mexdeskAPI.updateSessionControlState(false, false);
      }
      // Auto-lock Windows workstation on session disconnect if host session ended
      if (wasHost && !remainingHostSessions) {
        if (localStorage.getItem("aegisdesk_autolock_on_disconnect") === "true") {
          console.log("[AegisDesk] Host session disconnected - Auto-locking Windows workstation...");
          window.mexdeskAPI?.lockWorkstation?.();
        }
      }
      return next;
    });
    // If we were viewing this tab, switch to home or next session
    setActiveTab((prev) => {
      if (prev !== peerId) return prev;
      const remaining = Object.keys(sessions).filter((id) => id !== peerId);
      return remaining.length > 0 ? remaining[remaining.length - 1] : "home";
    });
  }, [sessions]);

  const createSession = useCallback((peerId, data = {}) => {
    const startTime = Date.now();
    auditLogger.logSessionStart(peerId, data.alias, data.role || "controller", data.permissions);

    setSessions((prev) => ({
      ...prev,
      [peerId]: {
        id: peerId,
        alias: data.alias || "",
        startTime,
        webrtc: data.webrtc || null,
        stream: data.stream || null,
        permissions: data.permissions || { control: true, fileTransfer: true, clipboard: true, audio: true },
        unreadChatCount: 0,
        isCalling: data.isCalling || false,
        connectionState: data.connectionState || "connecting",
        reconnectAttempt: data.reconnectAttempt || 0,
        localStream: data.localStream || null,
        role: data.role || "controller", // "controller" | "host"
      },
    }));
  }, []);

  // Dynamic in-session permission toggle for host
  const handleToggleHostPermission = useCallback((peerId, permissionKey) => {
    setSessions((prev) => {
      const session = prev[peerId];
      if (!session || session.role !== "host") return prev;

      const currentPerms = hostPermissionsRef.current[peerId] || session.permissions || {
        control: true,
        fileTransfer: true,
        clipboard: true,
        audio: true,
      };

      const updatedPerms = {
        ...currentPerms,
        [permissionKey]: !currentPerms[permissionKey],
      };

      hostPermissionsRef.current[peerId] = updatedPerms;
      auditLogger.logPermissionChange(peerId, { [permissionKey]: updatedPerms[permissionKey] });

      // Dynamically toggle audio tracks on localStream if audio permission is toggled
      if (permissionKey === "audio" && session.localStream) {
        const audioTracks = session.localStream.getAudioTracks();
        const shouldEnable = Boolean(updatedPerms.audio);
        audioTracks.forEach((t) => {
          t.enabled = shouldEnable;
        });
        console.log(`[AegisDesk] Toggled host audio stream enabled=${shouldEnable} (${audioTracks.length} tracks)`);
      }

      // Update native Electron security layer
      if (window.mexdeskAPI?.updateSessionControlState) {
        window.mexdeskAPI.updateSessionControlState(true, Boolean(updatedPerms.control));
      }

      // Notify remote peer via WebRTC data channel
      if (session.webrtc) {
        session.webrtc.send("control", {
          type: "permissions-updated",
          permissions: updatedPerms,
        });
      }

      return {
        ...prev,
        [peerId]: {
          ...session,
          permissions: updatedPerms,
        },
      };
    });
  }, []);

  // Emergency Pause / Resume All
  const handleToggleAllHostPermissions = useCallback((peerId) => {
    setSessions((prev) => {
      const session = prev[peerId];
      if (!session || session.role !== "host") return prev;

      const currentPerms = hostPermissionsRef.current[peerId] || session.permissions || {
        control: true,
        fileTransfer: true,
        clipboard: true,
        audio: true,
      };

      const anyActive = Boolean(currentPerms.control || currentPerms.clipboard || currentPerms.fileTransfer);
      const targetState = !anyActive;

      const updatedPerms = {
        control: targetState,
        clipboard: targetState,
        fileTransfer: targetState,
        audio: currentPerms.audio, // preserve audio preference
      };

      hostPermissionsRef.current[peerId] = updatedPerms;

      if (window.mexdeskAPI?.updateSessionControlState) {
        window.mexdeskAPI.updateSessionControlState(true, targetState);
      }

      if (session.webrtc) {
        session.webrtc.send("control", {
          type: "permissions-updated",
          permissions: updatedPerms,
        });
      }

      return {
        ...prev,
        [peerId]: {
          ...session,
          permissions: updatedPerms,
        },
      };
    });
  }, []);

  // Force manual reconnection attempt (ICE restart)
  const handleRetrySession = useCallback((peerId) => {
    setSessions((prev) => {
      const session = prev[peerId];
      if (!session || !session.webrtc) return prev;

      const nextAttempt = (session.reconnectAttempt || 0) + 1;
      console.log(`[AegisDesk] Manual reconnection requested for ${peerId} (Attempt ${nextAttempt})...`);
      session.webrtc.restartIce().catch((err) => console.warn("[AegisDesk] Manual retry error:", err));

      return {
        ...prev,
        [peerId]: {
          ...session,
          connectionState: "reconnecting",
          reconnectAttempt: nextAttempt,
        },
      };
    });
  }, []);

  // ─── Initialize Signaling Client ────────────────────────
  useEffect(() => {
    const client = new SignalingClient(signalingUrl);
    signalingRef.current = client;

    client.on("status", ({ connected }) => {
      setIsConnected(connected);
    });

    client.on("registered", (data) => {
      setMyId(data.id);
      localStorage.setItem("mexdesk_my_id", data.id);
      localStorage.setItem("mexdesk_device_static_id", data.id);
      if (data.authToken) {
        localStorage.setItem("mexdesk_device_token", data.authToken);
      }
      if (data.alias && !myAlias) {
        setMyAlias(data.alias);
        localStorage.setItem("mexdesk_my_alias", data.alias);
      }
      if (data.lanPeers && Array.isArray(data.lanPeers)) {
        setLanPeers(data.lanPeers);
      }
    });

    client.on("lan-peers", (data) => {
      if (data.peers && Array.isArray(data.peers)) setLanPeers(data.peers);
    });

    client.on("lan-peer-joined", (data) => {
      if (data.peer) {
        setLanPeers((prev) => {
          const filtered = prev.filter((p) => p.id !== data.peer.id);
          return [...filtered, data.peer];
        });
      }
    });

    client.on("lan-peer-left", (data) => {
      if (data.peerId) {
        setLanPeers((prev) => prev.filter((p) => p.id !== data.peerId));
      }
    });

    client.on("lan-peer-updated", (data) => {
      if (data.peer) {
        setLanPeers((prev) =>
          prev.map((p) => (p.id === data.peer.id ? { ...p, ...data.peer } : p))
        );
      }
    });

    client.on("presence-results", (presenceMap) => {
      if (presenceMap && typeof presenceMap === "object") {
        setPeerPresence((prev) => ({ ...prev, ...presenceMap }));
      }
    });

    client.on("alias-updated", (data) => {
      setMyAlias(data.alias);
      localStorage.setItem("mexdesk_my_alias", data.alias);
    });

    client.on("alias-error", (data) => {
      setErrorMessage(data.message || "Failed to set alias.");
      setTimeout(() => setErrorMessage(""), 4000);
    });

    // Incoming Call Handler
    client.on("incoming-call", (data) => {
      setIncomingCall(data);
    });

    // Ringing State
    client.on("call-ringing", () => {
      setIsCallingModal(true);
    });

    // Call Accepted (Caller Side) — Create session with WebRTC
    client.on("call-accepted", async (data) => {
      setIsCallingModal(false);
      setPasswordChallenge(null);

      const targetId = data.targetId;
      const activeAlias = data.targetAlias || callingTarget.alias || "";

      addRecentSession(targetId, activeAlias);

      // Initialize WebRTC as Caller / Controller
      const rtc = new WebRTCConnection(client, targetId, true);

      createSession(targetId, {
        alias: activeAlias,
        webrtc: rtc,
        permissions: data.permissions || {},
        isCalling: false,
        connectionState: "connecting",
        role: "controller",
      });

      setActiveTab(targetId);

      rtc.on("remote-stream", (stream) => {
        updateSession(targetId, { stream, connectionState: "connected" });
      });

      rtc.on("chat-message", () => {
        setSessions((prev) => {
          if (!prev[targetId]) return prev;
          return {
            ...prev,
            [targetId]: {
              ...prev[targetId],
              unreadChatCount: prev[targetId].unreadChatCount + 1,
            },
          };
        });
      });

      let reconnectIntervalTimer = null;
      let reconnectHardDeadlineTimer = null;
      let disconnectGraceTimer = null;
      let currentAttempts = 0;

      const attemptRecovery = () => {
        currentAttempts += 1;
        console.log(`[AegisDesk] Attempting connection recovery (${currentAttempts}/5) for ${targetId}...`);
        updateSession(targetId, {
          connectionState: "reconnecting",
          reconnectAttempt: currentAttempts,
        });
        rtc.restartIce().catch((err) => console.warn("[AegisDesk] Reconnect error:", err));
      };

      rtc.on("connection-state", (state) => {
        console.log(`[AegisDesk] Caller session state for ${targetId}:`, state);
        if (state === "connected") {
          if (disconnectGraceTimer) {
            clearTimeout(disconnectGraceTimer);
            disconnectGraceTimer = null;
          }
          if (reconnectIntervalTimer) {
            clearInterval(reconnectIntervalTimer);
            reconnectIntervalTimer = null;
          }
          if (reconnectHardDeadlineTimer) {
            clearTimeout(reconnectHardDeadlineTimer);
            reconnectHardDeadlineTimer = null;
          }
          currentAttempts = 0;
          updateSession(targetId, {
            connectionState: "connected",
            reconnectAttempt: 0,
          });
        } else if (state === "disconnected" || state === "failed") {
          // 8s grace period to prevent false alarms during initial ICE/STUN/TURN negotiation over internet
          if (!disconnectGraceTimer && !reconnectHardDeadlineTimer) {
            disconnectGraceTimer = setTimeout(() => {
              disconnectGraceTimer = null;
              const currentState = rtc.peerConnection?.connectionState;
              if (currentState === "disconnected" || currentState === "failed") {
                attemptRecovery();

                reconnectIntervalTimer = setInterval(() => {
                  if (currentAttempts < 5) {
                    attemptRecovery();
                  } else {
                    if (reconnectIntervalTimer) clearInterval(reconnectIntervalTimer);
                  }
                }, 5000);

                reconnectHardDeadlineTimer = setTimeout(() => {
                  if (reconnectIntervalTimer) clearInterval(reconnectIntervalTimer);
                  handleCloseSession(
                    targetId,
                    "Connection lost: remote desk did not respond after 5 reconnection attempts."
                  );
                }, 30000);
              }
            }, 8000);
          }
        } else if (state === "closed") {
          if (disconnectGraceTimer) clearTimeout(disconnectGraceTimer);
          handleCloseSession(targetId, "Remote desk closed connection.");
        }
      });

      await rtc.init();
      await rtc.createOffer();
    });

    // Call Rejected
    client.on("call-rejected", (data) => {
      setIsCallingModal(false);
      setErrorMessage(data.reason || "Connection rejected by remote desk.");
      setTimeout(() => setErrorMessage(""), 4000);
    });

    client.on("call-error", (data) => {
      setIsCallingModal(false);
      setErrorMessage(data.message || "Connection error.");
      setTimeout(() => setErrorMessage(""), 4000);
    });

    client.on("password-required", (data) => {
      setIsCallingModal(false);
      setPasswordChallenge(data);
      setChallengePasswordInput("");
    });

    client.on("server-error", (data) => {
      setErrorMessage(data.message || "Server error.");
      setTimeout(() => setErrorMessage(""), 4000);
    });

    // Offer received (Host Side)
    client.on("offer", async (data) => {
      const sender = data.senderId || data.from || data.peerId;
      console.log(`[AegisDesk] WebRTC offer received from ${sender}`);
      setSessions((prev) => {
        const session = prev[sender] || Object.values(prev).find((s) => s.id === sender || s.webrtc?.targetPeerId === sender);
        if (session?.webrtc) {
          session.webrtc.handleOffer(data.sdp);
        } else {
          console.warn(`[AegisDesk] No active session found for incoming offer from ${sender}`);
        }
        return prev;
      });
    });

    // Answer received (Caller Side)
    client.on("answer", async (data) => {
      const sender = data.senderId || data.from || data.peerId;
      console.log(`[AegisDesk] WebRTC answer received from ${sender}`);
      setSessions((prev) => {
        const session = prev[sender] || Object.values(prev).find((s) => s.id === sender || s.webrtc?.targetPeerId === sender);
        if (session?.webrtc) {
          session.webrtc.handleAnswer(data.sdp);
        } else {
          console.warn(`[AegisDesk] No active session found for incoming answer from ${sender}`);
        }
        return prev;
      });
    });

    // ICE candidate received
    client.on("ice-candidate", async (data) => {
      const sender = data.senderId || data.from || data.peerId;
      setSessions((prev) => {
        const session = prev[sender] || Object.values(prev).find((s) => s.id === sender || s.webrtc?.targetPeerId === sender);
        if (session?.webrtc) {
          session.webrtc.handleIceCandidate(data.candidate);
        }
        return prev;
      });
    });

    // Session ended by remote peer
    client.on("session-ended", (data) => {
      const peerId = data.peerId || data.senderId || data.from;
      if (peerId) {
        handleCloseSession(peerId, data.reason || "Session ended by remote desk.");
      }
    });

    // Unattended session started automatically
    client.on("unattended-session-started", async (data) => {
      console.log("[AegisDesk] Unattended session starting from caller:", data.callerId);
      if (startHostSessionRef.current) {
        await startHostSessionRef.current(
          data.callerId,
          data.callerAlias || "",
          data.permissions || {
            control: true,
            fileTransfer: true,
            clipboard: true,
            audio: true,
          }
        );
      }
    });

    const storedToken = localStorage.getItem("mexdesk_device_token") || null;
    client.connect(myId || null, myAlias || "AegisDesk Device", unattendedPassword || null, storedToken, optOutDiscovery);

    return () => {
      client.disconnect();
    };
  }, [signalingUrl]);

  // ─── Session Management ────────────────────────────────

  const handleSaveAlias = (newAlias) => {
    if (signalingRef.current) {
      signalingRef.current.setAlias(newAlias);
    }
  };

  const handleSaveDiscoveryOptOut = (optOut) => {
    setOptOutDiscovery(optOut);
    localStorage.setItem("mexdesk_opt_out_discovery", optOut ? "true" : "false");
    if (signalingRef.current) {
      signalingRef.current.setDiscoveryOptOut(optOut);
    }
  };

  const addRecentSession = (id, customAlias = null) => {
    setRecentSessions((prev) => {
      const existing = prev.find((s) => s.id === id);
      const aliasToUse = customAlias || existing?.alias || `Desk ${id}`;
      const updated = [
        { id, alias: aliasToUse, timestamp: Date.now() },
        ...prev.filter((s) => s.id !== id),
      ].slice(0, 10);
      localStorage.setItem("mexdesk_recent_sessions", JSON.stringify(updated));
      return updated;
    });
  };

  const handleRenameRecent = (id, newAlias) => {
    const aliasToUse = (newAlias || "").trim() || `Desk ${id}`;
    setRecentSessions((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, alias: aliasToUse } : s));
      localStorage.setItem("mexdesk_recent_sessions", JSON.stringify(updated));
      return updated;
    });
  };

  const removeRecentSession = (id) => {
    setRecentSessions((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      localStorage.setItem("mexdesk_recent_sessions", JSON.stringify(updated));
      return updated;
    });
  };

  // Host: Start screen streaming & WebRTC session
  const startHostSession = async (callerId, callerAlias, permissions) => {
    setIncomingCall(null);

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: "never", // Local cursor prediction: do not bake cursor into video frames
            frameRate: { ideal: 60, max: 60 },
          },
          audio: permissions.audio !== false,
        });
      } catch (audioErr) {
        console.warn("[AegisDesk] getDisplayMedia with audio failed, falling back to video-only:", audioErr);
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              cursor: "never",
              frameRate: { ideal: 60, max: 60 },
            },
            audio: false,
          });
        } catch (cursorErr) {
          // Fallback to cursor: always if platform restricts cursor: never
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              cursor: "always",
              frameRate: { ideal: 60, max: 60 },
            },
            audio: false,
          });
        }
      }

      // If initial permissions have audio disabled, mute audio tracks immediately
      if (permissions.audio === false) {
        stream.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }

      const rtc = new WebRTCConnection(signalingRef.current, callerId, false);

      createSession(callerId, {
        alias: callerAlias || "",
        webrtc: rtc,
        permissions,
        localStream: stream,
        connectionState: "connected",
        role: "host",
      });

      hostPermissionsRef.current[callerId] = { ...permissions };

      rtc.on("control-message", (event) => {
        const livePerms = hostPermissionsRef.current[callerId] || {};
        if (window.mexdeskAPI && livePerms.control) {
          window.mexdeskAPI.sendInput(event);
        }
      });

      rtc.on("chat-message", () => {
        setSessions((prev) => {
          if (!prev[callerId]) return prev;
          return {
            ...prev,
            [callerId]: {
              ...prev[callerId],
              unreadChatCount: prev[callerId].unreadChatCount + 1,
            },
          };
        });
      });

      let hostReconnectIntervalTimer = null;
      let hostReconnectHardDeadlineTimer = null;
      let hostDisconnectGraceTimer = null;
      let hostAttempts = 0;

      const attemptHostRecovery = () => {
        hostAttempts += 1;
        console.log(`[AegisDesk] Host attempting connection recovery (${hostAttempts}/5) for ${callerId}...`);
        updateSession(callerId, {
          connectionState: "reconnecting",
          reconnectAttempt: hostAttempts,
        });
        rtc.restartIce().catch((err) => console.warn("[AegisDesk] Host reconnect error:", err));
      };

      rtc.on("connection-state", (state) => {
        console.log(`[AegisDesk] Host session state for ${callerId}:`, state);
        if (state === "connected") {
          if (hostDisconnectGraceTimer) {
            clearTimeout(hostDisconnectGraceTimer);
            hostDisconnectGraceTimer = null;
          }
          if (hostReconnectIntervalTimer) {
            clearInterval(hostReconnectIntervalTimer);
            hostReconnectIntervalTimer = null;
          }
          if (hostReconnectHardDeadlineTimer) {
            clearTimeout(hostReconnectHardDeadlineTimer);
            hostReconnectHardDeadlineTimer = null;
          }
          hostAttempts = 0;
          updateSession(callerId, {
            connectionState: "connected",
            reconnectAttempt: 0,
          });
        } else if (state === "disconnected" || state === "failed") {
          // 8s grace period to prevent false alarms during initial ICE/STUN/TURN negotiation over internet
          if (!hostDisconnectGraceTimer && !hostReconnectHardDeadlineTimer) {
            hostDisconnectGraceTimer = setTimeout(() => {
              hostDisconnectGraceTimer = null;
              const currentState = rtc.peerConnection?.connectionState;
              if (currentState === "disconnected" || currentState === "failed") {
                attemptHostRecovery();

                hostReconnectIntervalTimer = setInterval(() => {
                  if (hostAttempts < 5) {
                    attemptHostRecovery();
                  } else {
                    if (hostReconnectIntervalTimer) clearInterval(hostReconnectIntervalTimer);
                  }
                }, 5000);

                hostReconnectHardDeadlineTimer = setTimeout(() => {
                  if (hostReconnectIntervalTimer) clearInterval(hostReconnectIntervalTimer);
                  handleCloseSession(
                    callerId,
                    "Connection lost: remote peer could not be reached after 5 recovery attempts."
                  );
                }, 30000);
              }
            }, 8000);
          }
        } else if (state === "closed") {
          if (hostDisconnectGraceTimer) clearTimeout(hostDisconnectGraceTimer);
          handleCloseSession(callerId, "Remote desk closed connection.");
        }
      });

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          handleCloseSession(callerId, "Screen sharing stopped by host user.");
        };
      }

      if (window.mexdeskAPI?.updateSessionControlState) {
        window.mexdeskAPI.updateSessionControlState(true, Boolean(permissions?.control));
      }

      await rtc.init(stream);
      signalingRef.current.acceptCall(callerId, permissions);
    } catch (err) {
      if (window.mexdeskAPI?.updateSessionControlState) {
        window.mexdeskAPI.updateSessionControlState(false, false);
      }
      console.error("[AegisDesk] Failed to start host session:", err);
      setErrorMessage("Could not share screen: " + err.message);
      setTimeout(() => setErrorMessage(""), 4000);
      signalingRef.current.rejectCall(callerId, "Screen capture was cancelled.");
    }
  };

  startHostSessionRef.current = startHostSession;

  // Host: Accept incoming connection
  const handleAcceptCall = async (permissions) => {
    if (!incomingCall || !signalingRef.current) return;
    const callerId = incomingCall.callerId;
    const callerAlias = incomingCall.callerAlias || "";
    await startHostSession(callerId, callerAlias, permissions);
  };

  // Host: Reject incoming connection
  const handleRejectCall = (reason) => {
    if (incomingCall && signalingRef.current) {
      signalingRef.current.rejectCall(incomingCall.callerId, reason);
      setIncomingCall(null);
    }
  };

  // Caller: Start connection request
  const handleStartConnect = (targetId, type = "full-control", password = null) => {
    if (!targetId || !targetId.trim()) {
      setErrorMessage("Please enter a valid 9-digit AegisDesk ID or alias.");
      setTimeout(() => setErrorMessage(""), 3500);
      return;
    }

    const cleanTarget = targetId.trim();

    if (cleanTarget === myId || (myAlias && cleanTarget.toLowerCase() === myAlias.toLowerCase())) {
      setErrorMessage("Cannot connect to your own desk address.");
      setTimeout(() => setErrorMessage(""), 3500);
      return;
    }

    if (!isConnected || !signalingRef.current?.isConnected) {
      setErrorMessage("Signaling server is connecting... Please wait a few seconds until the status displays 'Online'.");
      setTimeout(() => setErrorMessage(""), 4500);
      return;
    }

    // Resolve alias
    const knownLan = lanPeers.find(
      (p) => p.id === cleanTarget || (p.alias && p.alias.toLowerCase() === cleanTarget.toLowerCase())
    );
    const knownRecent = recentSessions.find(
      (s) => s.id === cleanTarget || (s.alias && s.alias.toLowerCase() === cleanTarget.toLowerCase())
    );
    const resolvedAlias = knownLan?.alias || knownRecent?.alias || "";

    setCallingTarget({ id: cleanTarget, alias: resolvedAlias });
    setErrorMessage("");
    setIsCallingModal(true);

    signalingRef.current.callUser(cleanTarget, myAlias || "AegisDesk User", password, type);
  };

  // Close a specific session
  const handleCloseSession = useCallback((peerId, reason = "Session closed") => {
    if (signalingRef.current) {
      signalingRef.current.hangup(peerId);
    }
    removeSession(peerId);

    if (reason) {
      setErrorMessage(reason);
      setTimeout(() => setErrorMessage(""), 3500);
    }
  }, [removeSession]);

  // Tab management
  const handleSwitchTab = (tabId) => {
    setActiveTab(tabId);
    // Reset unread count when switching to a session tab
    if (tabId !== "home") {
      updateSession(tabId, { unreadChatCount: 0 });
    }
  };

  const handleCloseTab = (peerId) => {
    handleCloseSession(peerId, "You ended the session.");
  };

  // Save Settings
  const handleSavePassword = (newPw) => {
    setUnattendedPassword(newPw);
    localStorage.setItem("mexdesk_unattended_pw", newPw);
    if (signalingRef.current) {
      signalingRef.current.setUnattendedPassword(newPw);
    }
  };

  const handleSaveSignalingUrl = (newUrl) => {
    setSignalingUrl(newUrl);
    localStorage.setItem("mexdesk_signaling_url", newUrl);
  };

  const handleSaveUpdatePref = (pref) => {
    setUpdatePref(pref);
    localStorage.setItem("aegisdesk_update_pref", pref);
  };

  const handleDismissUpdate = () => {
    setUpdateAvailable(null);
  };

  // Get current active session (if any)
  const activeSession = activeTab !== "home" ? sessions[activeTab] : null;
  const isViewingSession = activeSession && activeSession.stream && activeSession.role === "controller";
  const isHostingSession = activeSession && activeSession.role === "host";

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0F172A] text-slate-100 font-sans overflow-hidden select-none">
      {/* TitleBar with Session Tabs */}
      <TitleBar
        isOnline={isConnected}
        onSettings={() => setShowSettings(true)}
        activeTab={activeTab}
        sessions={sessions}
        onSwitchTab={handleSwitchTab}
        onCloseTab={handleCloseTab}
      />

      {/* Update Banner */}
      {updateAvailable && (
        <div className="bg-[#4F46E5] text-white text-xs px-4 py-2 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Download size={14} />
            <span className="font-medium">
              AegisDesk v{updateAvailable.version} is available.
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md font-semibold transition flex items-center gap-1"
            >
              <RefreshCw size={12} />
              Update Now
            </button>
            <button onClick={handleDismissUpdate} className="hover:opacity-80 px-1">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Global Error Banner (Destructive red) */}
      {errorMessage && (
        <div className="bg-[#EF4444] text-white text-xs px-4 py-2 flex items-center justify-between animate-in slide-in-from-top duration-200">
          <div className="flex items-center space-x-2">
            <AlertCircle size={14} />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage("")} className="hover:opacity-80">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Body — Render based on activeTab */}
      {/* Home Screen (visible when home tab is active) */}
      <div className={activeTab === "home" ? "flex-1 flex flex-col overflow-hidden" : "hidden"}>
        <HomeScreen
          myId={myId}
          myAlias={myAlias}
          onSaveAlias={handleSaveAlias}
          initialConnectTo={initialConnectTo}
          signalingUrl={signalingUrl}
          onConnect={(id, type) => handleStartConnect(id, type)}
          onFileTransferOnly={(id) => handleStartConnect(id, "file-transfer-only")}
          recentSessions={recentSessions}
          onRemoveRecent={removeRecentSession}
          onRenameRecent={handleRenameRecent}
          unattendedPassword={unattendedPassword}
          onConfigurePassword={() => setShowSettings(true)}
          onOpenSettings={() => setShowSettings(true)}
          lanPeers={lanPeers}
          onRefreshLanPeers={() => signalingRef.current?.discoverLan()}
          peerPresence={peerPresence}
          onQueryPresence={(ids) => signalingRef.current?.queryPresence(ids)}
        />
      </div>

      {/* Remote Viewer Sessions — Each session stays mounted, only visible one is shown */}
      {Object.entries(sessions).map(([peerId, session]) => {
        if (session.role !== "controller" || !session.stream) return null;
        return (
          <div
            key={peerId}
            className={activeTab === peerId ? "flex-1 flex flex-col overflow-hidden" : "hidden"}
          >
            <RemoteViewer
              webrtc={session.webrtc}
              remoteStream={session.stream}
              targetPeerId={peerId}
              targetPeerAlias={session.alias}
              permissions={session.permissions}
              connectionState={session.connectionState}
              reconnectAttempt={session.reconnectAttempt || 1}
              onRetryConnection={() => handleRetrySession(peerId)}
              onDisconnect={() => handleCloseSession(peerId, "You ended the session.")}
              unreadChatCount={session.unreadChatCount}
              onResetChatCount={() => updateSession(peerId, { unreadChatCount: 0 })}
            />
          </div>
        );
      })}

      {/* Hosting Sessions — Interactive Host Permission Control Center */}
      {Object.entries(sessions).map(([peerId, session]) => {
        if (session.role !== "host") return null;
        const perms = session.permissions || { control: true, fileTransfer: true, clipboard: true, audio: true };
        const anyControlActive = Boolean(perms.control || perms.clipboard || perms.fileTransfer);

        return (
          <div
            key={peerId}
            className={activeTab === peerId ? "flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6 max-w-2xl mx-auto overflow-y-auto" : "hidden"}
          >
            {/* Host Status Badge */}
            <div className="flex items-center space-x-3.5 bg-[#1E293B] border border-[#334155] rounded-2xl px-6 py-3.5 shadow-xl">
              <div className="w-10 h-10 rounded-xl bg-[#4F46E5]/20 border border-[#4F46E5]/40 flex items-center justify-center shrink-0">
                <AegisLogo size={24} />
              </div>
              <div className="text-left">
                <div className="flex items-center space-x-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      session.connectionState === "reconnecting"
                        ? "bg-amber-400 animate-ping"
                        : "bg-[#16A34A] animate-pulse"
                    }`}
                  />
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider ${
                      session.connectionState === "reconnecting"
                        ? "text-amber-300"
                        : "text-[#818CF8]"
                    }`}
                  >
                    {session.connectionState === "reconnecting"
                      ? `Reconnecting (Attempt ${session.reconnectAttempt || 1} of 5)...`
                      : "Active Screen Sharing Session"}
                  </span>
                </div>
                <h2 className="text-sm font-bold text-white">
                  Connected Peer:{" "}
                  <span className="text-[#818CF8] font-mono">
                    {session.alias ? `${session.alias} (${peerId})` : peerId}
                  </span>
                </h2>
              </div>
            </div>

            {/* Reconnecting Banner for Host */}
            {session.connectionState === "reconnecting" && (
              <div className="w-full bg-amber-500/15 border border-amber-500/40 rounded-2xl p-4 shadow-xl flex items-center justify-between text-left animate-in fade-in duration-200">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                    <RefreshCw size={18} className="text-amber-400 animate-spin" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-amber-300">
                      Connection Interrupted — Reconnecting (Attempt {session.reconnectAttempt || 1} of 5)...
                    </h4>
                    <p className="text-[11px] text-amber-200/80 mt-0.5">
                      Network disruption detected. Negotiating ICE restart with peer.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRetrySession(peerId)}
                  className="px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <RefreshCw size={13} />
                  <span>Retry Now</span>
                </button>
              </div>
            )}

            {/* In-Session Granular Permission Controls */}
            <div className="w-full bg-[#1E293B] border border-[#334155] rounded-2xl p-5 shadow-2xl space-y-4 text-left">
              <div className="flex items-center justify-between border-b border-[#334155] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Shield size={16} className="text-[#818CF8]" />
                    In-Session Access Permissions
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Click any permission below to instantly grant or revoke access in real-time.
                  </p>
                </div>
                {/* Emergency Pause / Resume All */}
                <button
                  onClick={() => handleToggleAllHostPermissions(peerId)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
                    anyControlActive
                      ? "bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25"
                      : "bg-[#16A34A]/15 border border-[#16A34A]/40 text-green-300 hover:bg-[#16A34A]/25"
                  }`}
                  title={anyControlActive ? "Instantly pause all remote control" : "Restore remote control"}
                >
                  {anyControlActive ? <Pause size={13} /> : <Play size={13} />}
                  <span>{anyControlActive ? "Pause All Control" : "Resume All Control"}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Mouse & Keyboard */}
                <button
                  type="button"
                  onClick={() => handleToggleHostPermission(peerId, "control")}
                  className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-semibold transition cursor-pointer text-left ${
                    perms.control
                      ? "bg-[#4F46E5]/15 border-[#4F46E5]/50 text-white shadow-sm"
                      : "bg-[#0F172A] border-[#334155] text-slate-400 hover:border-slate-500"
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className={`p-2 rounded-lg ${perms.control ? "bg-[#4F46E5] text-white" : "bg-slate-800 text-slate-500"}`}>
                      <MousePointer size={16} />
                    </div>
                    <div>
                      <span className="block text-slate-200">Mouse & Keyboard</span>
                      <span className="text-[10px] font-normal text-slate-400">
                        {perms.control ? "Remote control active" : "Control revoked (View only)"}
                      </span>
                    </div>
                  </div>
                  <div className={`w-8 h-4 rounded-full transition-colors relative ${perms.control ? "bg-[#16A34A]" : "bg-slate-700"}`}>
                    <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform absolute top-0.5 ${perms.control ? "right-0.5" : "left-0.5"}`} />
                  </div>
                </button>

                {/* Clipboard Sync */}
                <button
                  type="button"
                  onClick={() => handleToggleHostPermission(peerId, "clipboard")}
                  className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-semibold transition cursor-pointer text-left ${
                    perms.clipboard
                      ? "bg-[#4F46E5]/15 border-[#4F46E5]/50 text-white shadow-sm"
                      : "bg-[#0F172A] border-[#334155] text-slate-400 hover:border-slate-500"
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className={`p-2 rounded-lg ${perms.clipboard ? "bg-[#4F46E5] text-white" : "bg-slate-800 text-slate-500"}`}>
                      <Clipboard size={16} />
                    </div>
                    <div>
                      <span className="block text-slate-200">Clipboard Sync</span>
                      <span className="text-[10px] font-normal text-slate-400">
                        {perms.clipboard ? "Copy/paste enabled" : "Clipboard isolated"}
                      </span>
                    </div>
                  </div>
                  <div className={`w-8 h-4 rounded-full transition-colors relative ${perms.clipboard ? "bg-[#16A34A]" : "bg-slate-700"}`}>
                    <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform absolute top-0.5 ${perms.clipboard ? "right-0.5" : "left-0.5"}`} />
                  </div>
                </button>

                {/* File Transfer */}
                <button
                  type="button"
                  onClick={() => handleToggleHostPermission(peerId, "fileTransfer")}
                  className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-semibold transition cursor-pointer text-left ${
                    perms.fileTransfer
                      ? "bg-[#4F46E5]/15 border-[#4F46E5]/50 text-white shadow-sm"
                      : "bg-[#0F172A] border-[#334155] text-slate-400 hover:border-slate-500"
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className={`p-2 rounded-lg ${perms.fileTransfer ? "bg-[#4F46E5] text-white" : "bg-slate-800 text-slate-500"}`}>
                      <FolderSync size={16} />
                    </div>
                    <div>
                      <span className="block text-slate-200">File Transfer</span>
                      <span className="text-[10px] font-normal text-slate-400">
                        {perms.fileTransfer ? "P2P transfer allowed" : "File transfer blocked"}
                      </span>
                    </div>
                  </div>
                  <div className={`w-8 h-4 rounded-full transition-colors relative ${perms.fileTransfer ? "bg-[#16A34A]" : "bg-slate-700"}`}>
                    <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform absolute top-0.5 ${perms.fileTransfer ? "right-0.5" : "left-0.5"}`} />
                  </div>
                </button>

                {/* Audio Transmission */}
                <button
                  type="button"
                  onClick={() => handleToggleHostPermission(peerId, "audio")}
                  className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-semibold transition cursor-pointer text-left ${
                    perms.audio
                      ? "bg-[#4F46E5]/15 border-[#4F46E5]/50 text-white shadow-sm"
                      : "bg-[#0F172A] border-[#334155] text-slate-400 hover:border-slate-500"
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div className={`p-2 rounded-lg ${perms.audio ? "bg-[#4F46E5] text-white" : "bg-slate-800 text-slate-500"}`}>
                      <Volume2 size={16} />
                    </div>
                    <div>
                      <span className="block text-slate-200">Transmit Audio</span>
                      <span className="text-[10px] font-normal text-slate-400">
                        {perms.audio ? "Desktop audio sharing" : "Audio muted"}
                      </span>
                    </div>
                  </div>
                  <div className={`w-8 h-4 rounded-full transition-colors relative ${perms.audio ? "bg-[#16A34A]" : "bg-slate-700"}`}>
                    <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform absolute top-0.5 ${perms.audio ? "right-0.5" : "left-0.5"}`} />
                  </div>
                </button>
              </div>
            </div>

            {/* End Session Button */}
            <div className="pt-1">
              <button
                onClick={() => handleCloseSession(peerId, "You stopped sharing your screen.")}
                className="px-6 py-2.5 bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-bold rounded-xl shadow-md shadow-red-900/30 transition cursor-pointer flex items-center gap-2 mx-auto"
              >
                <X size={15} />
                <span>Disconnect & End Session</span>
              </button>
            </div>
          </div>
        );
      })}

      {/* Floating Host Session Quick-Access Pill (if viewing home tab while hosting) */}
      {activeTab === "home" && Object.entries(sessions).some(([_, s]) => s.role === "host") && (
        <div className="fixed bottom-4 right-4 z-40 bg-[#1E293B]/95 backdrop-blur-md border border-[#4F46E5]/40 p-3 rounded-2xl shadow-2xl flex items-center space-x-3 text-xs animate-in fade-in slide-in-from-bottom-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#16A34A] animate-ping" />
          <div>
            <span className="text-slate-300 font-bold block">Hosting Active Session</span>
            <span className="text-[10px] text-slate-400">Remote user connected</span>
          </div>
          {Object.entries(sessions).filter(([_, s]) => s.role === "host").map(([hostPeerId]) => (
            <button
              key={hostPeerId}
              onClick={() => setActiveTab(hostPeerId)}
              className="px-3 py-1.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold rounded-xl text-xs transition cursor-pointer"
            >
              Manage Permissions
            </button>
          ))}
        </div>
      )}

      {/* Calling / Connecting Dialog */}
      {isCallingModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1E293B] rounded-2xl border border-[#334155] shadow-2xl p-6 w-full max-w-sm text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-[#818CF8] flex items-center justify-center mx-auto animate-pulse">
              <AegisLogo size={28} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Connecting to Remote Desk...</h3>
              <p className="text-xs font-mono text-[#818CF8] font-semibold mt-1">
                {callingTarget.alias ? `${callingTarget.alias} (${callingTarget.id})` : callingTarget.id}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Waiting for remote user to accept...</p>
            </div>
            <button
              onClick={() => {
                setIsCallingModal(false);
                setErrorMessage("Connection attempt cancelled.");
                setTimeout(() => setErrorMessage(""), 3500);
              }}
              className="px-4 py-2 bg-[#0F172A] hover:bg-[#253248] text-slate-300 border border-[#334155] text-xs font-semibold rounded-xl transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Incoming Call Modal */}
      {incomingCall && (
        <IncomingCallModal
          callData={incomingCall}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          unattendedPassword={unattendedPassword}
          onSavePassword={handleSavePassword}
          signalingUrl={signalingUrl}
          onSaveSignalingUrl={handleSaveSignalingUrl}
          optOutDiscovery={optOutDiscovery}
          onSaveDiscoveryOptOut={handleSaveDiscoveryOptOut}
          updatePref={updatePref}
          onSaveUpdatePref={handleSaveUpdatePref}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Password Challenge Modal for Unattended Access */}
      {passwordChallenge && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1E293B] rounded-2xl border border-[#334155] shadow-2xl p-6 w-full max-w-sm space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
                <Lock size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Authentication Required</h3>
                <p className="text-[11px] text-slate-400">
                  Desk <span className="font-mono text-[#818CF8] font-semibold">{passwordChallenge.targetAlias || passwordChallenge.targetId}</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This desk requires an unattended access password before establishing a remote session.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!challengePasswordInput.trim()) return;
                const targetId = passwordChallenge.targetId;
                const pwd = challengePasswordInput;
                setPasswordChallenge(null);
                setChallengePasswordInput("");
                handleStartConnect(targetId, "full-control", pwd);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Unattended Password
                </label>
                <input
                  type="password"
                  value={challengePasswordInput}
                  onChange={(e) => setChallengePasswordInput(e.target.value)}
                  placeholder="Enter remote password..."
                  autoFocus
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#334155] bg-[#0F172A] text-white focus:bg-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#818CF8]/40 focus:border-[#818CF8] transition font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setPasswordChallenge(null);
                    setChallengePasswordInput("");
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!challengePasswordInput.trim()}
                  className="px-4 py-1.5 bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center space-x-1.5"
                >
                  <span>Connect</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
