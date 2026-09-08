import React, { useState, useEffect, useRef } from "react";
import { TitleBar } from "./components/TitleBar";
import { HomeScreen } from "./components/HomeScreen";
import { RemoteViewer } from "./components/RemoteViewer";
import { IncomingCallModal } from "./components/IncomingCallModal";
import { SettingsModal } from "./components/SettingsModal";
import { SignalingClient } from "./services/SignalingClient";
import { WebRTCConnection } from "./services/WebRTCConnection";
import { Lock, ArrowRight, X, AlertCircle } from "lucide-react";

export function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [myId, setMyId] = useState(localStorage.getItem("mexdesk_my_id") || "");
  const [myAlias, setMyAlias] = useState(localStorage.getItem("mexdesk_my_alias") || "");
  const [unattendedPassword, setUnattendedPassword] = useState(
    localStorage.getItem("mexdesk_unattended_pw") || ""
  );
  const urlParams = new URLSearchParams(window.location.search);
  const queryServer = urlParams.get("server");
  const queryConnect = urlParams.get("connectTo") || "";

  const defaultSignaling =
    queryServer ||
    localStorage.getItem("mexdesk_signaling_url") ||
    (window.location.protocol === "https:"
      ? `wss://${window.location.host}`
      : window.location.protocol === "http:" && window.location.hostname !== "localhost"
      ? `ws://${window.location.host}`
      : "ws://localhost:7777");

  const [signalingUrl, setSignalingUrl] = useState(defaultSignaling);
  const [initialConnectTo] = useState(queryConnect);

  // Active Session State
  const [sessionState, setSessionState] = useState("home"); // "home", "calling", "hosting", "controlling"
  const [remoteId, setRemoteId] = useState("");
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

  // Settings Modal
  const [showSettings, setShowSettings] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // References
  const signalingRef = useRef(null);
  const webrtcRef = useRef(null);
  const localStreamRef = useRef(null);

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
      if (data.alias && !myAlias) {
        setMyAlias(data.alias);
        localStorage.setItem("mexdesk_my_alias", data.alias);
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

    // Call Accepted (Caller Side)
    client.on("call-accepted", async (data) => {
      setIsCallingModal(false);
      setPasswordChallenge(null);
      setSessionPermissions(data.permissions || {});

      // Add to recent sessions
      addRecentSession(data.targetId);

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

      rtc.on("connection-state", (state) => {
        if (state === "disconnected" || state === "closed" || state === "failed") {
          handleEndSession("Connection disconnected");
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

    client.connect(myId || null, myAlias || "MexDesk Device", unattendedPassword || null);

    return () => {
      client.disconnect();
    };
  }, [signalingUrl]);

  const handleSaveAlias = (newAlias) => {
    if (signalingRef.current) {
      signalingRef.current.setAlias(newAlias);
    }
  };

  const addRecentSession = (id) => {
    const updated = [
      { id, alias: `Desk ${id}`, timestamp: Date.now() },
      ...recentSessions.filter((s) => s.id !== id),
    ].slice(0, 10);
    setRecentSessions(updated);
    localStorage.setItem("mexdesk_recent_sessions", JSON.stringify(updated));
  };

  const removeRecentSession = (id) => {
    const updated = recentSessions.filter((s) => s.id !== id);
    setRecentSessions(updated);
    localStorage.setItem("mexdesk_recent_sessions", JSON.stringify(updated));
  };

  // Host: Accept incoming connection
  const handleAcceptCall = async (permissions) => {
    if (!incomingCall || !signalingRef.current) return;
    const callerId = incomingCall.callerId;
    setIncomingCall(null);
    setSessionPermissions(permissions);
    setRemoteId(callerId);

    try {
      // Capture host screen stream
      let stream;
      if (window.mexdeskAPI?.isElectron) {
        // Under Electron: capture screen using getDisplayMedia or desktopCapturer
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: "always",
            frameRate: { ideal: 60, max: 60 },
          },
          audio: permissions.audio,
        });
      } else {
        // Under Web / Browser: standard screen capture prompt
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: "always",
            frameRate: { ideal: 60, max: 60 },
          },
          audio: permissions.audio,
        });
      }

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

      rtc.on("connection-state", (state) => {
        if (state === "disconnected" || state === "closed") {
          handleEndSession("Remote desk closed connection");
        }
      });

      await rtc.init(stream);
      signalingRef.current.acceptCall(callerId, permissions);
      setSessionState("hosting");
    } catch (err) {
      console.error("Screen capture cancelled or failed:", err);
      signalingRef.current.rejectCall(callerId, "Screen capture was cancelled.");
    }
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
    if (!signalingRef.current || !targetId) return;
    setRemoteId(targetId);
    setErrorMessage("");

    signalingRef.current.callUser(targetId, "MexDesk Client", password, type);
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
          unattendedPassword={unattendedPassword}
          onConfigurePassword={() => setShowSettings(true)}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {sessionState === "controlling" && (
        <RemoteViewer
          webrtc={webrtcRef.current}
          remoteStream={remoteStream}
          targetPeerId={remoteId}
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
              Sharing screen with Desk <span className="font-mono text-mexdesk-red">{remoteId}</span>
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
              <p className="text-xs font-mono text-mexdesk-red font-semibold mt-1">{remoteId}</p>
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
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
