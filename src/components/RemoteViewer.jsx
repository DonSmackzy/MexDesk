import React, { useEffect, useRef, useState } from "react";
import {
  PhoneOff,
  Maximize2,
  Minimize2,
  FolderSync,
  MessageSquare,
  PenTool,
  Video,
  EyeOff,
  Monitor,
  Activity,
  Command,
  ChevronDown,
  Lock,
  Volume2,
  VolumeX,
} from "lucide-react";
import { InputCapture } from "../services/InputCapture";
import { WhiteboardOverlay } from "./WhiteboardOverlay";
import { ChatDrawer } from "./ChatDrawer";
import { FileTransferModal } from "./FileTransferModal";

export function RemoteViewer({
  webrtc,
  remoteStream,
  targetPeerId,
  permissions = { control: true, fileTransfer: true, clipboard: true, audio: true },
  onDisconnect,
  unreadChatCount,
  onResetChatCount,
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const inputCaptureRef = useRef(null);

  // UI state
  const [scaleMode, setScaleMode] = useState("fit"); // "fit", "original", "stretch"
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [stats, setStats] = useState({ fps: 60, bitrate: 2450, latency: 28 });

  // Floating menus & drawers
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showFileTransfer, setShowFileTransfer] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);

  // Session Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // Bind remote stream to video element
  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
      videoRef.current.play().catch((e) => console.warn("Auto-play error:", e));
    }
  }, [remoteStream]);

  // Attach input capture
  useEffect(() => {
    if (permissions.control && containerRef.current && webrtc) {
      const capture = new InputCapture(webrtc, containerRef.current);
      capture.attach(containerRef.current);
      inputCaptureRef.current = capture;

      return () => {
        capture.detach();
      };
    }
  }, [permissions.control, webrtc]);

  // Listen to WebRTC stats
  useEffect(() => {
    if (webrtc) {
      const unsubscribe = webrtc.on("stats", (newStats) => {
        setStats(newStats);
      });
      return unsubscribe;
    }
  }, [webrtc]);

  // Recording timer
  useEffect(() => {
    let timer = null;
    if (isRecording) {
      timer = setInterval(() => setRecordDuration((prev) => prev + 1), 1000);
    } else {
      setRecordDuration(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  const toggleRecording = () => {
    if (!isRecording) {
      if (!remoteStream) return;
      try {
        recordedChunksRef.current = [];
        const recorder = new MediaRecorder(remoteStream, {
          mimeType: "video/webm;codecs=vp8,opus",
        });

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = async () => {
          const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `MexDesk-Session-${targetPeerId}-${Date.now()}.webm`;
          a.click();
          URL.revokeObjectURL(url);
        };

        recorder.start(1000);
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
      } catch (err) {
        console.error("Failed to start recording:", err);
      }
    } else {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => console.warn(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.warn(err));
      setIsFullscreen(false);
    }
  };

  const sendShortcut = (name) => {
    if (inputCaptureRef.current) {
      inputCaptureRef.current.sendShortcut(name);
    }
    setShowActionsDropdown(false);
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden select-none outline-none"
      tabIndex={0}
    >
      {/* Remote Screen Video View */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        className={`max-w-full max-h-full transition-all duration-150 ${
          scaleMode === "original"
            ? "object-none"
            : scaleMode === "stretch"
            ? "w-full h-full object-fill"
            : "object-contain"
        }`}
      />

      {/* Privacy Mode Curtain */}
      {privacyMode && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center text-white z-20">
          <EyeOff size={48} className="text-mexdesk-red mb-3" />
          <h3 className="text-lg font-bold">Privacy Mode Enabled</h3>
          <p className="text-xs text-slate-400 mt-1">Host display is blacked out for confidentiality.</p>
          <button
            onClick={() => setPrivacyMode(false)}
            className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg border border-slate-700 transition"
          >
            Disable Privacy Mode
          </button>
        </div>
      )}

      {/* Live Whiteboard Canvas Overlay */}
      {showWhiteboard && (
        <WhiteboardOverlay
          webrtc={webrtc}
          onClose={() => setShowWhiteboard(false)}
        />
      )}

      {/* ANYDESK FLOATING TOOLBAR */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-full px-2.5 py-1.5 shadow-floating text-slate-700 space-x-1">
        {/* Remote desk identifier */}
        <div className="flex items-center space-x-1.5 px-2 border-r border-slate-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="text-xs font-mono font-bold text-slate-800">{targetPeerId}</span>
        </div>

        {/* Display scaling mode */}
        <button
          onClick={() =>
            setScaleMode((prev) => (prev === "fit" ? "stretch" : prev === "stretch" ? "original" : "fit"))
          }
          className="p-1.5 rounded-full hover:bg-slate-100 transition text-slate-600 hover:text-slate-900"
          title={`Scale: ${scaleMode}`}
        >
          <Monitor size={15} />
        </button>

        {/* Actions Dropdown (Shortcuts) */}
        <div className="relative">
          <button
            onClick={() => setShowActionsDropdown(!showActionsDropdown)}
            className="flex items-center space-x-0.5 p-1.5 rounded-full hover:bg-slate-100 transition text-slate-600 hover:text-slate-900"
            title="Special Keys & Actions"
          >
            <Command size={15} />
            <ChevronDown size={12} />
          </button>

          {showActionsDropdown && (
            <div className="absolute top-full mt-2 left-0 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 w-44 z-50 text-xs font-medium text-slate-700 space-y-0.5">
              <button
                onClick={() => sendShortcut("ctrl_alt_del")}
                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-rose-50 hover:text-mexdesk-red transition"
              >
                Send Ctrl + Alt + Del
              </button>
              <button
                onClick={() => sendShortcut("alt_tab")}
                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                Send Alt + Tab
              </button>
              <button
                onClick={() => {
                  setPrivacyMode(!privacyMode);
                  setShowActionsDropdown(false);
                }}
                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 transition flex items-center justify-between"
              >
                <span>Privacy Screen</span>
                <span className="text-[10px] text-slate-400">{privacyMode ? "ON" : "OFF"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Interactive Whiteboard */}
        <button
          onClick={() => setShowWhiteboard(!showWhiteboard)}
          className={`p-1.5 rounded-full transition ${
            showWhiteboard
              ? "bg-mexdesk-red text-white"
              : "hover:bg-slate-100 text-slate-600 hover:text-slate-900"
          }`}
          title="Whiteboard & Annotation"
        >
          <PenTool size={15} />
        </button>

        {/* Session Recording */}
        <button
          onClick={toggleRecording}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded-full transition text-xs font-semibold ${
            isRecording
              ? "bg-rose-600 text-white animate-record"
              : "hover:bg-slate-100 text-slate-600 hover:text-slate-900"
          }`}
          title="Record Session"
        >
          <Video size={14} />
          {isRecording && <span className="font-mono">{formatTimer(recordDuration)}</span>}
        </button>

        {/* Dual-pane File Transfer */}
        {permissions.fileTransfer && (
          <button
            onClick={() => setShowFileTransfer(true)}
            className="p-1.5 rounded-full hover:bg-slate-100 transition text-slate-600 hover:text-slate-900"
            title="File Transfer"
          >
            <FolderSync size={15} />
          </button>
        )}

        {/* In-Session Chat */}
        <button
          onClick={() => {
            setShowChat(!showChat);
            if (!showChat && onResetChatCount) onResetChatCount();
          }}
          className="relative p-1.5 rounded-full hover:bg-slate-100 transition text-slate-600 hover:text-slate-900"
          title="Chat"
        >
          <MessageSquare size={15} />
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-mexdesk-red text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-full hover:bg-slate-100 transition text-slate-600 hover:text-slate-900"
          title="Fullscreen"
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>

        {/* Performance Stats Toggle */}
        <button
          onClick={() => setShowStats(!showStats)}
          className={`p-1.5 rounded-full transition ${
            showStats ? "text-mexdesk-red bg-rose-50" : "text-slate-400 hover:bg-slate-100"
          }`}
          title="Toggle Stream Statistics"
        >
          <Activity size={15} />
        </button>

        <div className="h-4 w-px bg-slate-200"></div>

        {/* AnyDesk Iconic Red Disconnect Button */}
        <button
          onClick={onDisconnect}
          className="flex items-center space-x-1 px-3 py-1 bg-mexdesk-red hover:bg-mexdesk-crimson text-white text-xs font-semibold rounded-full shadow-sm transition"
        >
          <PhoneOff size={13} />
          <span>End</span>
        </button>
      </div>

      {/* Stream Performance HUD */}
      {showStats && (
        <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-lg px-3 py-1.5 text-[11px] text-slate-300 font-mono flex items-center space-x-3 pointer-events-none z-10 shadow-lg">
          <div className="flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>{stats.fps || 60} FPS</span>
          </div>
          <span>•</span>
          <span>{stats.bitrate ? `${stats.bitrate} kbps` : "2.4 Mbps"}</span>
          <span>•</span>
          <span>{stats.latency ? `${stats.latency} ms` : "24 ms"}</span>
        </div>
      )}

      {/* Slide-over In-Session Chat Drawer */}
      {showChat && (
        <ChatDrawer
          webrtc={webrtc}
          targetPeerId={targetPeerId}
          onClose={() => setShowChat(false)}
        />
      )}

      {/* Dual-Pane File Transfer Modal */}
      {showFileTransfer && (
        <FileTransferModal
          webrtc={webrtc}
          targetPeerId={targetPeerId}
          onClose={() => setShowFileTransfer(false)}
        />
      )}
    </div>
  );
}
