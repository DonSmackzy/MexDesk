import React, { useState, useEffect, useRef, useCallback } from "react";
import { TitleBar } from "./components/TitleBar";
import { HomeScreen } from "./components/HomeScreen";
import { RemoteViewer } from "./components/RemoteViewer";
import { IncomingCallModal } from "./components/IncomingCallModal";
import { SettingsModal } from "./components/SettingsModal";
import { SignalingClient } from "./services/SignalingClient";
import { WebRTCConnection } from "./services/WebRTCConnection";
import { Lock, ArrowRight, X, AlertCircle, Download, RefreshCw } from "lucide-react";

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

  // LAN Discovery
  const [lanPeers, setLanPeers] = useState([]);
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
      // Cleanup WebRTC
      if (next[peerId]?.webrtc) {
        next[peerId].webrtc.close();
      }
      // Cleanup local stream
      if (next[peerId]?.localStream) {
        next[peerId].localStream.getTracks().forEach((t) => t.stop());
      }
      delete next[peerId];
      const remainingHostSessions = Object.values(next).some((s) => s.role === "host");
      if (!remainingHostSessions && window.mexdeskAPI?.updateSessionControlState) {
        window.mexdeskAPI.updateSessionControlState(false, false);
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
    setSessions((prev) => ({
      ...prev,
      [peerId]: {
        id: peerId,
        alias: data.alias || "",
        webrtc: data.webrtc || null,
        stream: data.stream || null,
        permissions: data.permissions || { control: true, fileTransfer: true, clipboard: true, audio: true },
        unreadChatCount: 0,
        isCalling: data.isCalling || false,
        connectionState: data.connectionState || "connecting",
        localStream: data.localStream || null,
        role: data.role || "controller", // "controller" | "host"
      },
    }));
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

      let callerDisconnectTimer = null;
      rtc.on("connection-state", (state) => {
        if (state === "connected") {
          if (callerDisconnectTimer) {
            clearTimeout(callerDisconnectTimer);
            callerDisconnectTimer = null;
          }
          updateSession(targetId, { connectionState: "connected" });
        } else if (state === "failed" || state === "closed") {
          if (!callerDisconnectTimer) {
            callerDisconnectTimer = setTimeout(() => {
              handleCloseSession(targetId, "Connection disconnected (ICE failure)");
            }, 12000);
          }
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
      // Route offer to the correct session's WebRTC instance
      setSessions((prev) => {
        const session = Object.values(prev).find((s) => s.webrtc?.remotePeerId === data.from || s.id === data.from);
        if (session?.webrtc) {
          session.webrtc.handleOffer(data.sdp);
        }
        return prev;
      });
    });

    // Answer received (Caller Side)
    client.on("answer", async (data) => {
      setSessions((prev) => {
        const session = Object.values(prev).find((s) => s.webrtc?.remotePeerId === data.from || s.id === data.from);
        if (session?.webrtc) {
          session.webrtc.handleAnswer(data.sdp);
        }
        return prev;
      });
    });

    // ICE candidate received
    client.on("ice-candidate", async (data) => {
      setSessions((prev) => {
        const session = Object.values(prev).find((s) => s.webrtc?.remotePeerId === data.from || s.id === data.from);
        if (session?.webrtc) {
          session.webrtc.handleIceCandidate(data.candidate);
        }
        return prev;
      });
    });

    // Session ended by remote peer
    client.on("session-ended", (data) => {
      const peerId = data.peerId || data.from;
      if (peerId) {
        handleCloseSession(peerId, data.reason || "Session ended by remote desk.");
      }
    });

    // Unattended session started automatically
    client.on("unattended-session-started", async (data) => {
      console.log("[AegisDesk] Unattended session starting from caller:", data.callerId);
      if (startHostSessionRef.current) {
        await startHostSessionRef.current(data.callerId, data.permissions || {
          control: true,
          fileTransfer: true,
          clipboard: true,
          audio: true,
        });
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
  const startHostSession = async (callerId, permissions) => {
    setIncomingCall(null);

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          frameRate: { ideal: 60, max: 60 },
        },
        audio: permissions.audio || false,
      });

      const rtc = new WebRTCConnection(signalingRef.current, callerId, false);

      createSession(callerId, {
        alias: callingTarget.alias || "",
        webrtc: rtc,
        permissions,
        localStream: stream,
        connectionState: "connected",
        role: "host",
      });

      rtc.on("control-message", (event) => {
        if (window.mexdeskAPI && permissions.control) {
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

      let hostDisconnectTimer = null;
      rtc.on("connection-state", (state) => {
        if (state === "connected") {
          if (hostDisconnectTimer) {
            clearTimeout(hostDisconnectTimer);
            hostDisconnectTimer = null;
          }
          updateSession(callerId, { connectionState: "connected" });
        } else if (state === "failed" || state === "closed") {
          if (!hostDisconnectTimer) {
            hostDisconnectTimer = setTimeout(() => {
              handleCloseSession(callerId, "Remote desk closed connection");
            }, 12000);
          }
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
    await startHostSession(callerId, permissions);
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
              onDisconnect={() => handleCloseSession(peerId, "You ended the session.")}
              unreadChatCount={session.unreadChatCount}
              onResetChatCount={() => updateSession(peerId, { unreadChatCount: 0 })}
            />
          </div>
        );
      })}

      {/* Hosting Sessions — Show host panel if active tab is a host session */}
      {Object.entries(sessions).map(([peerId, session]) => {
        if (session.role !== "host") return null;
        return (
          <div
            key={peerId}
            className={activeTab === peerId ? "flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4" : "hidden"}
          >
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 text-[#818CF8] flex items-center justify-center animate-pulse border border-indigo-500/30">
              <span className="text-2xl font-bold">M</span>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold text-[#818CF8] block mb-1">
                Active Host Session
              </span>
              <h2 className="text-xl font-bold text-white">
                Sharing screen with Desk{" "}
                <span className="font-mono text-[#818CF8]">
                  {session.alias ? `${session.alias} (${peerId})` : peerId}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                The remote desk can view and control your computer according to granted permissions.
              </p>
            </div>

            <button
              onClick={() => handleCloseSession(peerId, "You stopped sharing your screen.")}
              className="px-6 py-2.5 bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-semibold rounded-xl shadow-md shadow-red-900/30 transition cursor-pointer"
            >
              End Remote Session
            </button>
          </div>
        );
      })}

      {/* Calling / Connecting Dialog */}
      {isCallingModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1E293B] rounded-2xl border border-[#334155] shadow-2xl p-6 w-full max-w-sm text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-[#818CF8] flex items-center justify-center mx-auto animate-pulse">
              <span className="text-lg font-bold">M</span>
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
