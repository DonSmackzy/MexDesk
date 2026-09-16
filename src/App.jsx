import React, { useState, useEffect, useRef } from "react";
import { TitleBar } from "./components/TitleBar";
import { HomeScreen } from "./components/HomeScreen";
import { RemoteViewer } from "./components/RemoteViewer";
import { IncomingCallModal } from "./components/IncomingCallModal";
import { SettingsModal } from "./components/SettingsModal";
import { SignalingClient } from "./services/SignalingClient";
import { WebRTCConnection } from "./services/WebRTCConnection";
import { Lock, ArrowRight, X, AlertCircle } from "lucide-react";

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
  const [myAlias, setMyAlias] = useState(localStorage.getItem("mexdesk_my_alias") || "");
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

    if (isDev) {
      return saved || "ws://localhost:7777";
    }

    if (saved && !saved.includes("localhost") && !saved.includes("127.0.0.1")) {
      return saved;
    }

    if (window.location.protocol === "https:") {
      return `wss://${window.location.host}`;
    }

    return CLOUD_SIGNALING;
  };

  const [signalingUrl, setSignalingUrl] = useState(getInitialSignalingUrl);
  const [initialConnectTo] = useState(queryConnect);

  // Active Session State
  const [sessionState, setSessionState] = useState("home"); // "home", "calling", "hosting", "controlling"
  const [remoteId, setRemoteId] = useState("");
  const [remoteAlias, setRemoteAlias] = useState("");
  const [remoteStream, setRemoteStream] = useState(null);
  const [sessionPermissions, setSessionPermissions] = useState({
    control: true,
    fileTransfer: true,
    clipboard: true,
    audio: true,
  });

  // Call modals
  const [incomingCall, setIncomingCall] = useState(null);
  const [isCallingModal, setIsCallingModal] = useState(false);
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

  // Local Network Discovery Peers & Preferences
  const [lanPeers, setLanPeers] = useState([]);
  const [optOutDiscovery, setOptOutDiscovery] = useState(
    () => localStorage.getItem("mexdesk_opt_out_discovery") === "true"
  );

  // Settings Modal
  const [showSettings, setShowSettings] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // References
  const signalingRef = useRef(null);
  const webrtcRef = useRef(null);
  const localStreamRef = useRef(null);
  const startHostSessionRef = useRef(null);

  // Initialize Signaling Client
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
      if (data.peers && Array.isArray(data.peers)) {
        setLanPeers(data.peers);
      }
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
      if (data.callerAlias) {
        setRemoteAlias(data.callerAlias);
      }
    });

    // Ringing State
    client.on("call-ringing", () => {
      setIsCallingModal(true);
    });

    // Call Accepted (Caller Side)
    client.on("call-accepted", async (data) => {
      setIsCallingModal(false);
      setPasswordChallenge(null);
      setSessionPermissions(data.permissions || {});

      const activeAlias = data.targetAlias || remoteAlias || "";
      if (activeAlias) {
        setRemoteAlias(activeAlias);
      }

      // Add to recent sessions with alias
      addRecentSession(data.targetId, activeAlias);

      // Initialize WebRTC as Caller / Controller
      const rtc = new WebRTCConnection(client, data.targetId, true);
      webrtcRef.current = rtc;

      rtc.on("remote-stream", (stream) => {
        setRemoteStream(stream);
        setSessionState("controlling");
      });

      rtc.on("chat-message", () => {
        setUnreadChatCount((prev) => prev + 1);
      });

      let callerDisconnectTimer = null;
      rtc.on("connection-state", (state) => {
        if (state === "connected") {
          if (callerDisconnectTimer) {
            clearTimeout(callerDisconnectTimer);
            callerDisconnectTimer = null;
          }
        } else if (state === "failed" || state === "closed") {
          if (!callerDisconnectTimer) {
            callerDisconnectTimer = setTimeout(() => {
              handleEndSession("Connection disconnected (ICE failure)");
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
      if (webrtcRef.current) {
        await webrtcRef.current.handleOffer(data.sdp);
      }
    });

    // Answer received (Caller Side)
    client.on("answer", async (data) => {
      if (webrtcRef.current) {
        await webrtcRef.current.handleAnswer(data.sdp);
      }
    });

    // ICE candidate received
    client.on("ice-candidate", async (data) => {
      if (webrtcRef.current) {
        await webrtcRef.current.handleIceCandidate(data.candidate);
      }
    });

    // Session ended by remote peer
    client.on("session-ended", (data) => {
      handleEndSession(data.reason || "Session ended by remote desk.");
    });

    // Unattended session started automatically
    client.on("unattended-session-started", async (data) => {
      console.log("[MexDesk] Unattended session starting from caller:", data.callerId);
      if (startHostSessionRef.current) {
        await startHostSessionRef.current(data.callerId, data.permissions || {
          control: true,
          fileTransfer: true,
          clipboard: true,
          audio: true
        });
      }
    });

    const storedToken = localStorage.getItem("mexdesk_device_token") || null;
    client.connect(myId || null, myAlias || "MexDesk Device", unattendedPassword || null, storedToken, optOutDiscovery);

    return () => {
      client.disconnect();
    };
  }, [signalingUrl]);

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
    const existing = recentSessions.find((s) => s.id === id);
    const aliasToUse = customAlias || existing?.alias || `Desk ${id}`;
    const updated = [
      { id, alias: aliasToUse, timestamp: Date.now() },
      ...recentSessions.filter((s) => s.id !== id),
    ].slice(0, 10);
    setRecentSessions(updated);
    localStorage.setItem("mexdesk_recent_sessions", JSON.stringify(updated));
  };

  const handleRenameRecent = (id, newAlias) => {
    const aliasToUse = (newAlias || "").trim() || `Desk ${id}`;
    const updated = recentSessions.map((s) =>
      s.id === id ? { ...s, alias: aliasToUse } : s
    );
    setRecentSessions(updated);
    localStorage.setItem("mexdesk_recent_sessions", JSON.stringify(updated));
  };

  const removeRecentSession = (id) => {
    const updated = recentSessions.filter((s) => s.id !== id);
    setRecentSessions(updated);
    localStorage.setItem("mexdesk_recent_sessions", JSON.stringify(updated));
  };

  // Host: Start screen streaming & WebRTC session
  const startHostSession = async (callerId, permissions) => {
    setIncomingCall(null);
    setSessionPermissions(permissions);
    setRemoteId(callerId);

    try {
      // Capture host screen stream
      // In Electron: getDisplayMedia is intercepted by setDisplayMediaRequestHandler in main.js
      // which auto-grants the primary screen with ZERO picker prompts (seamless like AnyDesk)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          frameRate: { ideal: 60, max: 60 },
        },
        audio: permissions.audio || false,
      });

      localStreamRef.current = stream;

      // Initialize WebRTC as Host (receiver of offer)
      const rtc = new WebRTCConnection(signalingRef.current, callerId, false);
      webrtcRef.current = rtc;

      rtc.on("control-message", (event) => {
        // Dispatch to native input injection in Electron
        if (window.mexdeskAPI && permissions.control) {
          window.mexdeskAPI.sendInput(event);
        }
      });

      rtc.on("chat-message", () => {
        setUnreadChatCount((prev) => prev + 1);
      });

      let hostDisconnectTimer = null;
      rtc.on("connection-state", (state) => {
        if (state === "connected") {
          if (hostDisconnectTimer) {
            clearTimeout(hostDisconnectTimer);
            hostDisconnectTimer = null;
          }
        } else if (state === "failed" || state === "closed") {
          if (!hostDisconnectTimer) {
            hostDisconnectTimer = setTimeout(() => {
              handleEndSession("Remote desk closed connection");
            }, 12000);
          }
        }
      });

      await rtc.init(stream);
      signalingRef.current.acceptCall(callerId, permissions);
    } catch (err) {
      console.error("[MexDesk] Failed to start host session:", err);
      setErrorMessage("Could not share screen: " + err.message);
      setTimeout(() => setErrorMessage(""), 4000);
      signalingRef.current.rejectCall(callerId, "Screen capture was cancelled.");
      handleEndSession();
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
      setErrorMessage("Please enter a valid 9-digit MexDesk ID or alias.");
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

    // Resolve alias if known locally
    const knownLan = lanPeers.find(
      (p) => p.id === cleanTarget || (p.alias && p.alias.toLowerCase() === cleanTarget.toLowerCase())
    );
    const knownRecent = recentSessions.find(
      (s) => s.id === cleanTarget || (s.alias && s.alias.toLowerCase() === cleanTarget.toLowerCase())
    );
    const resolvedAlias = knownLan?.alias || knownRecent?.alias || "";
    setRemoteAlias(resolvedAlias);

    setRemoteId(cleanTarget);
    setErrorMessage("");
    setIsCallingModal(true);

    signalingRef.current.callUser(cleanTarget, myAlias || "MexDesk User", password, type);
  };

  // End Session
  const handleEndSession = (reason = "Session closed") => {
    if (signalingRef.current) {
      signalingRef.current.hangup();
    }
    if (webrtcRef.current) {
      webrtcRef.current.close();
      webrtcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setRemoteStream(null);
    setSessionState("home");
    setUnreadChatCount(0);
    setIsCallingModal(false);
    setPasswordChallenge(null);

    if (reason) {
      setErrorMessage(reason);
      setTimeout(() => setErrorMessage(""), 3500);
    }
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

  return (
    <div className="h-screen w-screen flex flex-col bg-[#F8FAFC] text-slate-800 font-sans overflow-hidden select-none">
      {/* TitleBar */}
      <TitleBar
        isConnected={isConnected}
        myId={myId}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="bg-mexdesk-red text-white text-xs px-4 py-2 flex items-center justify-between animate-in slide-in-from-top duration-200">
          <div className="flex items-center space-x-2">
            <AlertCircle size={14} />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage("")} className="hover:opacity-80">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Body */}
      {sessionState === "home" && (
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
      )}

      {sessionState === "controlling" && (
        <RemoteViewer
          webrtc={webrtcRef.current}
          remoteStream={remoteStream}
          targetPeerId={remoteId}
          targetPeerAlias={remoteAlias}
          permissions={sessionPermissions}
          onDisconnect={() => handleEndSession("You ended the session.")}
          unreadChatCount={unreadChatCount}
          onResetChatCount={() => setUnreadChatCount(0)}
        />
      )}

      {sessionState === "hosting" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-mexdesk-lightred text-mexdesk-red flex items-center justify-center animate-pulse shadow-redglow">
            <span className="text-2xl font-bold">M</span>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-mexdesk-red block mb-1">
              Active Host Session
            </span>
            <h2 className="text-xl font-bold text-slate-800">
              Sharing screen with Desk <span className="font-mono text-mexdesk-red">{remoteAlias ? `${remoteAlias} (${remoteId})` : remoteId}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              The remote desk can view and control your computer according to granted permissions.
            </p>
          </div>

          <button
            onClick={() => handleEndSession("You stopped sharing your screen.")}
            className="px-6 py-2.5 bg-mexdesk-red hover:bg-mexdesk-crimson text-white text-xs font-semibold rounded-xl shadow-md shadow-red-500/20 transition cursor-pointer"
          >
            End Remote Session
          </button>
        </div>
      )}

      {/* Calling / Connecting Dialog */}
      {isCallingModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 w-full max-w-sm text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-200 text-mexdesk-red flex items-center justify-center mx-auto animate-record">
              <span className="text-lg font-bold">M</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Connecting to Remote Desk...</h3>
              <p className="text-xs font-mono text-mexdesk-red font-semibold mt-1">
                {remoteAlias ? `${remoteAlias} (${remoteId})` : remoteId}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Waiting for remote user to accept...</p>
            </div>
            <button
              onClick={() => handleEndSession("Connection attempt cancelled.")}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
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
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Password Challenge Modal for Unattended Access */}
      {passwordChallenge && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 w-full max-w-sm space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
                <Lock size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Authentication Required</h3>
                <p className="text-[11px] text-slate-500">
                  Desk <span className="font-mono text-mexdesk-red font-semibold">{passwordChallenge.targetAlias || passwordChallenge.targetId}</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
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
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Unattended Password
                </label>
                <input
                  type="password"
                  value={challengePasswordInput}
                  onChange={(e) => setChallengePasswordInput(e.target.value)}
                  placeholder="Enter remote password..."
                  autoFocus
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-mexdesk-red/30 focus:border-mexdesk-red transition font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setPasswordChallenge(null);
                    setChallengePasswordInput("");
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!challengePasswordInput.trim()}
                  className="px-4 py-1.5 bg-mexdesk-red hover:bg-mexdesk-crimson disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center space-x-1.5"
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
