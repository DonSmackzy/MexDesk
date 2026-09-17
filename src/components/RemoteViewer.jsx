import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Square,
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
  ChevronUp,
  Pin,
  PinOff,
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
  targetPeerAlias = "",
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
  const [isMuted, setIsMuted] = useState(true); // Default to muted for seamless video autoplay
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState({ fps: 0, bitrate: 0, latency: 0 });

  // Auto-hide Collapsible Toolbar state (3 seconds timeout)
  const [isToolbarHidden, setIsToolbarHidden] = useState(false);
  const [isToolbarHovered, setIsToolbarHovered] = useState(false);
  const [isToolbarPinned, setIsToolbarPinned] = useState(false);
  const hideTimerRef = useRef(null);

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

  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (isToolbarPinned || showActionsDropdown || showChat || showFileTransfer || showWhiteboard) {
      setIsToolbarHidden(false);
      return;
    }
    setIsToolbarHidden(false);
    hideTimerRef.current = setTimeout(() => {
      if (!isToolbarHovered) {
        setIsToolbarHidden(true);
      }
    }, 3000);
  }, [isToolbarPinned, showActionsDropdown, showChat, showFileTransfer, showWhiteboard, isToolbarHovered]);

  // Bind remote stream to video element
  useEffect(() => {
    const video = videoRef.current;
    if (video && remoteStream) {
      video.srcObject = remoteStream;
      video.muted = isMuted;
      video.playsInline = true;

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          console.warn("[AegisDesk Viewer] Autoplay blocked, forcing muted playback:", e);
          video.muted = true;
          video.play().catch((err) => console.warn("[AegisDesk Viewer] Retry play failed:", err));
        });
      }
    }
  }, [remoteStream, isMuted]);

  // Attach input capture
  useEffect(() => {
    if (permissions.control && containerRef.current && webrtc) {
      const capture = new InputCapture(webrtc, containerRef.current, videoRef.current);
      capture.attach(containerRef.current, videoRef.current);
      inputCaptureRef.current = capture;

      return () => {
        capture.detach();
      };
    }
  }, [permissions.control, webrtc, remoteStream]);

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
          a.download = `AegisDesk-Session-${targetPeerId}-${Date.now()}.webm`;
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

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [resetHideTimer]);

  return (
    <div
      ref={containerRef}
      onMouseMove={(e) => {
        if (e.clientY <= 45) {
          setIsToolbarHidden(false);
          resetHideTimer();
        }
      }}
      className="relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden select-none outline-none"
      tabIndex={0}
    >
      {/* Remote Screen Video View */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        onLoadedMetadata={() => videoRef.current?.play().catch(() => {})}
        onCanPlay={() => videoRef.current?.play().catch(() => {})}
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
          <EyeOff size={48} className="text-aegis-red mb-3" />
          <h3 className="text-lg font-bold">Privacy Curtain Active</h3>
          <p className="text-xs text-slate-400 mt-1">Remote display is obscured on your viewer screen for privacy.</p>
          <button
            onClick={() => setPrivacyMode(false)}
            className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg border border-slate-700 transition"
          >
            Disable Privacy Curtain
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

      {/* Top Edge Hover Hotspot */}
      <div
        onMouseEnter={() => {
          setIsToolbarHidden(false);
          resetHideTimer();
        }}
        className="absolute top-0 left-0 right-0 h-3 z-30 pointer-events-auto"
      />

      {/* Collapsed Pull-Down Handle */}
      {isToolbarHidden && (
        <button
          onClick={() => {
            setIsToolbarHidden(false);
            resetHideTimer();
          }}
          onMouseEnter={() => {
            setIsToolbarHidden(false);
            resetHideTimer();
          }}
          className="absolute top-0 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1 bg-[#0F172A]/95 hover:bg-[#1E293B] backdrop-blur-md border-b border-x border-[#334155] rounded-b-xl shadow-md text-slate-300 hover:text-[#818CF8] transition-all cursor-pointer flex items-center space-x-1.5 text-xs font-semibold animate-in slide-in-from-top-2 duration-150"
          title="Click or hover to reveal toolbar"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span className="truncate max-w-[140px] text-white">{targetPeerAlias || targetPeerId}</span>
          <ChevronDown size={13} className="text-slate-400" />
        </button>
      )}

      {/* FLOATING TOOLBAR */}
      <div
        onMouseEnter={() => {
          setIsToolbarHovered(true);
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        }}
        onMouseLeave={() => {
          setIsToolbarHovered(false);
          resetHideTimer();
        }}
        className={`absolute top-2 left-1/2 -translate-x-1/2 z-30 flex items-center bg-[#0F172A]/95 backdrop-blur-md border border-[#334155] rounded-full px-2.5 py-1.5 shadow-floating text-slate-200 space-x-1 transition-all duration-300 transform ${
          isToolbarHidden
            ? "-translate-y-16 opacity-0 pointer-events-none"
            : "translate-y-0 opacity-100 pointer-events-auto"
        }`}
      >
        {/* Remote desk identifier & Alias */}
        <div className="flex items-center space-x-1.5 px-2 border-r border-[#334155] max-w-[220px]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
          {targetPeerAlias && targetPeerAlias !== targetPeerId ? (
            <div className="truncate flex items-baseline space-x-1 min-w-0">
              <span className="text-xs font-bold text-white truncate">{targetPeerAlias}</span>
              <span className="text-[10px] font-mono text-[#818CF8] shrink-0">({targetPeerId})</span>
            </div>
          ) : (
            <span className="text-xs font-mono font-bold text-[#818CF8]">{targetPeerId}</span>
          )}
        </div>

        {/* Display scaling mode */}
        <button
          onClick={() =>
            setScaleMode((prev) => (prev === "fit" ? "stretch" : prev === "stretch" ? "original" : "fit"))
          }
          className="p-1.5 rounded-full hover:bg-[#1E293B] transition text-slate-300 hover:text-white"
          title={`Scale: ${scaleMode}`}
        >
          <Monitor size={15} />
        </button>

        {/* Actions Dropdown (Shortcuts) */}
        <div className="relative">
          <button
            onClick={() => setShowActionsDropdown(!showActionsDropdown)}
            className="flex items-center space-x-0.5 p-1.5 rounded-full hover:bg-[#1E293B] transition text-slate-300 hover:text-white"
            title="Special Keys & Actions"
          >
            <Command size={15} />
            <ChevronDown size={12} />
          </button>

          {showActionsDropdown && (
            <div className="absolute top-full mt-2 left-0 bg-[#1E293B] border border-[#334155] rounded-xl shadow-xl p-1.5 w-44 z-50 text-xs font-medium text-slate-200 space-y-0.5">
              <button
                onClick={() => sendShortcut("ctrl_alt_del")}
                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-[#334155] hover:text-white transition"
              >
                Send Ctrl + Alt + Del
              </button>
              <button
                onClick={() => sendShortcut("alt_tab")}
                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-[#334155] hover:text-white transition"
              >
                Send Alt + Tab
              </button>
              <button
                onClick={() => {
                  setPrivacyMode(!privacyMode);
                  setShowActionsDropdown(false);
                }}
                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-[#334155] hover:text-white transition flex items-center justify-between"
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
              ? "bg-[#4F46E5] text-white"
              : "hover:bg-[#1E293B] text-slate-300 hover:text-white"
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
              : "hover:bg-[#1E293B] text-slate-300 hover:text-white"
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
            className="p-1.5 rounded-full hover:bg-[#1E293B] transition text-slate-300 hover:text-white"
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
          className="relative p-1.5 rounded-full hover:bg-[#1E293B] transition text-slate-300 hover:text-white"
          title="Chat"
        >
          <MessageSquare size={15} />
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#EF4444] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 rounded-full hover:bg-[#1E293B] transition text-slate-300 hover:text-white"
          title="Fullscreen"
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>

        {/* Performance Stats Toggle */}
        <button
          onClick={() => setShowStats(!showStats)}
          className={`p-1.5 rounded-full transition ${
            showStats ? "text-[#818CF8] bg-[#4F46E5]/20" : "text-slate-400 hover:bg-[#1E293B] hover:text-white"
          }`}
          title="Toggle Stream Statistics"
        >
          <Activity size={15} />
        </button>

        {/* Pin / Unpin Toolbar */}
        <button
          onClick={() => {
            const next = !isToolbarPinned;
            setIsToolbarPinned(next);
            if (next) {
              if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
              setIsToolbarHidden(false);
            } else {
              resetHideTimer();
            }
          }}
          className={`p-1.5 rounded-full transition ${
            isToolbarPinned ? "text-[#818CF8] bg-[#4F46E5]/20" : "text-slate-400 hover:bg-[#1E293B] hover:text-white"
          }`}
          title={isToolbarPinned ? "Toolbar pinned (always visible)" : "Pin toolbar (stop auto-hide)"}
        >
          {isToolbarPinned ? <PinOff size={15} /> : <Pin size={15} />}
        </button>

        {/* Quick Collapse Button */}
        <button
          onClick={() => setIsToolbarHidden(true)}
          className="p-1.5 rounded-full text-slate-400 hover:bg-[#1E293B] hover:text-slate-200 transition"
          title="Collapse toolbar (hover top edge to reveal)"
        >
          <ChevronUp size={15} />
        </button>

        <div className="h-4 w-px bg-[#334155]"></div>

        {/* Destructive Disconnect Button */}
        <button
          onClick={onDisconnect}
          className="flex items-center space-x-1 px-3 py-1 bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-semibold rounded-full shadow-sm transition cursor-pointer"
        >
          <Square size={12} className="fill-white" />
          <span>Disconnect</span>
        </button>
      </div>

      {/* Stream Performance HUD */}
      {showStats && (
        <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-lg px-3 py-1.5 text-[11px] text-slate-300 font-mono flex items-center space-x-3 pointer-events-none z-10 shadow-lg">
          <div className="flex items-center space-x-1">
            <span className={`w-1.5 h-1.5 rounded-full ${stats.fps > 0 ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`}></span>
            <span>{stats.fps > 0 ? `${stats.fps} FPS` : "Measuring..."}</span>
          </div>
          <span>•</span>
          <span>{stats.bitrate > 0 ? `${stats.bitrate} kbps` : "-- kbps"}</span>
          <span>•</span>
          <span>{stats.latency > 0 ? `${stats.latency} ms` : "-- ms"}</span>
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
