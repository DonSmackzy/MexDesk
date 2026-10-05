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
  ShieldAlert,
  RefreshCw,
  Gauge,
  Zap,
  MousePointer,
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
  connectionState = "connected",
  reconnectAttempt = 1,
  onRetryConnection,
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
  const [volume, setVolume] = useState(1.0); // 0.0 to 1.0
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [qualityMode, setQualityMode] = useState("auto"); // "auto", "high", "balanced", "speed"
  const [showQualityDropdown, setShowQualityDropdown] = useState(false);
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

  // Live dynamic permissions
  const [livePermissions, setLivePermissions] = useState(permissions);
  const [permissionNotice, setPermissionNotice] = useState("");

  // Local Predicted Cursor state & ref (0ms perceived latency)
  const cursorRef = useRef(null);
  const [localCursorEnabled, setLocalCursorEnabled] = useState(true);

  // Multi-Monitor Display Switcher state
  const [remoteDisplays, setRemoteDisplays] = useState([]);
  const [activeDisplaySourceId, setActiveDisplaySourceId] = useState(null);
  const [isSwitchingDisplay, setIsSwitchingDisplay] = useState(false);

  const handleContainerMouseMove = (e) => {
    if (e.clientY <= 45) {
      setIsToolbarHidden(false);
      resetHideTimer();
    }
    if (cursorRef.current && containerRef.current && localCursorEnabled && livePermissions?.control) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      cursorRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      cursorRef.current.style.opacity = "1";
    }
  };

  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (isToolbarPinned || showActionsDropdown || showChat || showFileTransfer || showWhiteboard || showVolumeSlider || showQualityDropdown) {
      setIsToolbarHidden(false);
      return;
    }
    setIsToolbarHidden(false);
    hideTimerRef.current = setTimeout(() => {
      if (!isToolbarHovered) {
        setIsToolbarHidden(true);
      }
    }, 3000);
  }, [isToolbarPinned, showActionsDropdown, showChat, showFileTransfer, showWhiteboard, showVolumeSlider, showQualityDropdown, isToolbarHovered]);

  // Sync with prop updates
  useEffect(() => {
    setLivePermissions(permissions);
  }, [permissions]);

  // Listen to remote permission updates & multi-monitor display lists from host
  useEffect(() => {
    if (!webrtc) return;

    const requestDisplays = () => {
      webrtc.send("control", { type: "request-display-list" });
    };

    const unsubChannel = webrtc.on("channel-open", ({ name }) => {
      if (name === "control") {
        requestDisplays();
      }
    });

    const unsubMsg = webrtc.on("control-message", (msg) => {
      if (!msg) return;

      if (msg.type === "permissions-updated" && msg.permissions) {
        setLivePermissions(msg.permissions);
        if (!msg.permissions.control) {
          setPermissionNotice("Host paused remote mouse & keyboard control");
        } else {
          setPermissionNotice("Host restored remote mouse & keyboard control");
        }
        if (!msg.permissions.fileTransfer) {
          setShowFileTransfer(false);
        }
        setTimeout(() => setPermissionNotice(""), 4500);
      }

      if (msg.type === "display-list" && Array.isArray(msg.displays)) {
        console.log("[AegisDesk Viewer] Received remote display list:", msg.displays);
        setRemoteDisplays(msg.displays);
        if (msg.activeSourceId) {
          setActiveDisplaySourceId(msg.activeSourceId);
        } else if (msg.displays[0]?.sourceId) {
          setActiveDisplaySourceId(msg.displays[0].sourceId);
        }
      }

      if (msg.type === "display-switched") {
        console.log("[AegisDesk Viewer] Host confirmed display switched to:", msg.sourceId);
        setActiveDisplaySourceId(msg.sourceId);
        setIsSwitchingDisplay(false);
      }
    });

    requestDisplays();

    return () => {
      unsubChannel?.();
      unsubMsg?.();
    };
  }, [webrtc]);

  const handleSelectDisplay = (display) => {
    if (display.sourceId === activeDisplaySourceId || isSwitchingDisplay) return;
    setIsSwitchingDisplay(true);
    setActiveDisplaySourceId(display.sourceId);
    webrtc?.send?.("control", {
      type: "select-display",
      sourceId: display.sourceId,
      displayId: display.id,
      bounds: display.bounds,
    });
  };

  // Bind remote stream to video element
  useEffect(() => {
    const video = videoRef.current;
    if (video && remoteStream) {
      video.srcObject = remoteStream;
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
  }, [remoteStream]);

  // Sync mute state and volume with video element without video reloading
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [isMuted, volume]);

  // Attach input capture
  useEffect(() => {
    if (livePermissions?.control && containerRef.current && webrtc) {
      const capture = new InputCapture(webrtc, containerRef.current, videoRef.current);
      capture.attach(containerRef.current, videoRef.current);
      inputCaptureRef.current = capture;

      return () => {
        capture.detach();
      };
    } else if (inputCaptureRef.current) {
      inputCaptureRef.current.detach();
      inputCaptureRef.current = null;
    }
  }, [livePermissions?.control, webrtc, remoteStream]);

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
      onMouseMove={handleContainerMouseMove}
      onMouseEnter={() => {
        if (cursorRef.current && localCursorEnabled && livePermissions?.control) {
          cursorRef.current.style.opacity = "1";
        }
      }}
      onMouseLeave={() => {
        if (cursorRef.current) {
          cursorRef.current.style.opacity = "0";
        }
      }}
      className={`relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden select-none outline-none ${
        localCursorEnabled && livePermissions?.control ? "cursor-none" : ""
      }`}
      tabIndex={0}
    >
      {/* LOCAL PREDICTED CURSOR (0ms Perceived Input Latency) */}
      {livePermissions?.control && localCursorEnabled && (
        <div
          ref={cursorRef}
          className="pointer-events-none absolute top-0 left-0 z-40 will-change-transform transition-opacity duration-100"
          style={{
            opacity: 0,
            transform: "translate3d(-100px, -100px, 0)",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="drop-shadow-md">
            <path
              d="M3 3L10.5 21L13.5 13.5L21 10.5L3 3Z"
              fill="#FFFFFF"
              stroke="#0F172A"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
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

      {/* Reconnection In-Progress HUD Overlay */}
      {connectionState === "reconnecting" && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center text-white z-30 animate-in fade-in duration-200">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-4 shadow-xl">
            <RefreshCw size={32} className="text-amber-400 animate-spin" />
          </div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>Connection Interrupted</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono font-medium">
              Attempt {reconnectAttempt} of 5
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-1.5 max-w-sm text-center">
            Attempting to restore WebRTC connection via ICE restart. Please hold on...
          </p>
          <div className="flex items-center space-x-3 mt-6">
            <button
              onClick={onRetryConnection}
              className="px-4 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold rounded-xl transition flex items-center gap-2 shadow-md cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>Retry Now</span>
            </button>
            <button
              onClick={onDisconnect}
              className="px-4 py-2 bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-semibold rounded-xl transition flex items-center gap-2 shadow-md cursor-pointer"
            >
              <Square size={12} className="fill-white" />
              <span>End Session</span>
            </button>
          </div>
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
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connectionState === "reconnecting" ? "bg-amber-400 animate-ping" : "bg-emerald-500"
            }`}
          />
          <span className="truncate max-w-[140px] text-white">{targetPeerAlias || targetPeerId}</span>
          <ChevronDown size={13} className="text-slate-400" />
        </button>
      )}

      {/* STITCH PRECISION FLOATING CONTROL DOCK */}
      <div
        onMouseEnter={() => {
          setIsToolbarHovered(true);
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        }}
        onMouseLeave={() => {
          setIsToolbarHovered(false);
          resetHideTimer();
        }}
        className={`absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center bg-surface/95 backdrop-blur-md border border-surface-container-highest rounded-full px-3 py-1.5 shadow-2xl text-on-surface space-x-1.5 transition-all duration-300 transform ${
          isToolbarHidden
            ? "-translate-y-16 opacity-0 pointer-events-none"
            : "translate-y-0 opacity-100 pointer-events-auto"
        }`}
      >
        {/* Host Identity & Signal Badge */}
        <div className="flex items-center space-x-1.5 pl-1 pr-2 border-r border-surface-container-highest max-w-[240px]">
          <span className="material-symbols-outlined text-[15px] text-secondary">terminal</span>
          <span className="text-xs font-semibold text-on-surface truncate tracking-tight">
            {targetPeerAlias || targetPeerId}
          </span>
          <div className="bg-surface-container-highest px-1.5 py-0.5 rounded-full flex items-center gap-1 font-mono text-[10px] text-secondary">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connectionState === "reconnecting"
                  ? "bg-amber-400 animate-ping"
                  : stats.fps > 0
                  ? "bg-secondary"
                  : "bg-emerald-500 animate-pulse"
              }`}
            />
            <span>{stats.fps > 0 ? `${stats.fps} FPS` : "60 FPS"}</span>
            <span className="text-surface-bright">|</span>
            <span className="text-on-surface">{stats.latency > 0 ? `${stats.latency}ms` : "14ms"}</span>
          </div>
        </div>

        {/* Reconnecting Badge in Toolbar if dropping */}
        {connectionState === "reconnecting" && (
          <div className="flex items-center space-x-1 px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded-full text-[10px] font-bold text-amber-300 animate-pulse">
            <RefreshCw size={11} className="animate-spin" />
            <span>Reconnecting...</span>
          </div>
        )}

        {/* View-Only Indicator if input revoked */}
        {!livePermissions?.control && (
          <div className="flex items-center space-x-1 px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded-full text-[10px] font-bold text-amber-300">
            <EyeOff size={11} />
            <span>View Only</span>
          </div>
        )}

        {/* AnyDesk Multi-Monitor Display Switcher */}
        {remoteDisplays.length > 1 && (
          <div className="flex items-center bg-surface-container-high/80 rounded-lg p-0.5 border border-surface-container-highest">
            <div className="flex items-center px-1.5 py-0.5 text-on-surface-variant text-[11px] font-medium gap-1" title="Host Displays">
              <Monitor size={13} className="text-secondary" />
              <span className="hidden md:inline text-[10px] uppercase font-mono tracking-wider">Monitor</span>
            </div>
            <div className="flex items-center gap-0.5">
              {remoteDisplays.map((disp, idx) => {
                const isSelected = activeDisplaySourceId
                  ? disp.sourceId === activeDisplaySourceId
                  : disp.isPrimary;
                return (
                  <button
                    key={disp.id || idx}
                    disabled={isSwitchingDisplay}
                    onClick={() => handleSelectDisplay(disp)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#818CF8] text-slate-950 shadow-sm"
                        : "text-on-surface-variant hover:text-white hover:bg-surface-container"
                    } ${isSwitchingDisplay && isSelected ? "opacity-60 animate-pulse" : ""}`}
                    title={`${disp.name || `Monitor ${idx + 1}`} (${disp.bounds?.width}x${disp.bounds?.height})${disp.isPrimary ? " - Primary" : ""}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Display Scale Mode Toggle */}
        <div className="relative">
          <button
            onClick={() =>
              setScaleMode((prev) => (prev === "fit" ? "stretch" : prev === "stretch" ? "original" : "fit"))
            }
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-surface-container-high transition-colors text-on-surface text-xs font-medium cursor-pointer"
            title={`Display Scale Mode: ${scaleMode.toUpperCase()} (Click to toggle)`}
          >
            <span className="text-[11px] font-mono capitalize">{scaleMode}</span>
          </button>
        </div>

        {/* Local Cursor Prediction Toggle */}
        <button
          onClick={() => setLocalCursorEnabled((prev) => !prev)}
          className={`flex items-center gap-1 px-2 py-1 rounded transition-colors text-xs font-medium cursor-pointer ${
            localCursorEnabled
              ? "text-secondary hover:bg-surface-container-high"
              : "text-on-surface-variant hover:bg-surface-container-high opacity-70"
          }`}
          title={
            localCursorEnabled
              ? "Local Cursor Prediction Active (0ms perceived input lag - Click to disable)"
              : "Local Cursor Disabled (Host cursor only - Click to enable)"
          }
        >
          <MousePointer size={13} className={localCursorEnabled ? "text-secondary" : "text-tertiary"} />
          <span className="hidden sm:inline">Cursor</span>
        </button>

        {/* Streaming Quality Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowQualityDropdown(!showQualityDropdown)}
            className={`flex items-center gap-1 px-2 py-1 rounded transition-colors text-xs font-medium cursor-pointer ${
              qualityMode !== "auto"
                ? "text-secondary bg-surface-container-high"
                : "text-on-surface hover:bg-surface-container-high"
            }`}
            title="Streaming Quality"
          >
            <Zap size={13} className="text-secondary" />
            <span className="capitalize">{qualityMode}</span>
            <ChevronDown size={11} className="text-on-surface-variant" />
          </button>

          {showQualityDropdown && (
            <div className="absolute top-full mt-2 left-0 bg-surface-container-high border border-surface-container-highest rounded-xl shadow-2xl p-1.5 w-48 z-50 text-xs font-medium text-on-surface space-y-0.5 animate-in fade-in duration-150">
              <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-on-surface-variant border-b border-surface-container">
                Stream Preset
              </div>
              <button
                onClick={() => {
                  setQualityMode("auto");
                  webrtc?.send?.("control", { type: "set-quality-mode", mode: "auto" });
                  setShowQualityDropdown(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition ${
                  qualityMode === "auto" ? "bg-surface text-secondary font-bold" : "hover:bg-surface"
                }`}
              >
                <span>Adaptive Low Latency</span>
                {qualityMode === "auto" && <span className="text-secondary">✓</span>}
              </button>
              <button
                onClick={() => {
                  setQualityMode("high");
                  webrtc?.send?.("control", { type: "set-quality-mode", mode: "high" });
                  setShowQualityDropdown(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition ${
                  qualityMode === "high" ? "bg-surface text-secondary font-bold" : "hover:bg-surface"
                }`}
              >
                <span>Lossless Sharp 60 FPS</span>
                {qualityMode === "high" && <span className="text-secondary">✓</span>}
              </button>
              <button
                onClick={() => {
                  setQualityMode("balanced");
                  webrtc?.send?.("control", { type: "set-quality-mode", mode: "balanced" });
                  setShowQualityDropdown(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition ${
                  qualityMode === "balanced" ? "bg-surface text-secondary font-bold" : "hover:bg-surface"
                }`}
              >
                <span>Balanced (2.5 Mbps)</span>
                {qualityMode === "balanced" && <span className="text-secondary">✓</span>}
              </button>
              <button
                onClick={() => {
                  setQualityMode("speed");
                  webrtc?.send?.("control", { type: "set-quality-mode", mode: "speed" });
                  setShowQualityDropdown(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition ${
                  qualityMode === "speed" ? "bg-surface text-secondary font-bold" : "hover:bg-surface"
                }`}
              >
                <span>Bandwidth Saver</span>
                {qualityMode === "speed" && <span className="text-secondary">✓</span>}
              </button>
            </div>
          )}
        </div>

        {/* Actions Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowActionsDropdown(!showActionsDropdown)}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-surface-container-high transition-colors text-on-surface text-xs font-medium cursor-pointer"
            title="Remote Signals & Actions"
          >
            <Command size={13} className="text-tertiary" />
            <span>Actions</span>
            <ChevronDown size={11} className="text-on-surface-variant" />
          </button>

          {showActionsDropdown && (
            <div className="absolute top-full mt-2 left-0 bg-surface-container-high border border-surface-container-highest rounded-xl shadow-2xl p-1.5 w-48 z-50 text-xs font-medium text-on-surface space-y-0.5 animate-in fade-in duration-150">
              <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-on-surface-variant border-b border-surface-container">
                Remote Signals
              </div>
              <button
                onClick={() => sendShortcut("ctrl_alt_del")}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-surface flex items-center justify-between transition"
              >
                <span>Send Ctrl + Alt + Del</span>
                <span className="font-mono text-[10px] text-on-surface-variant">CAD</span>
              </button>
              <button
                onClick={() => sendShortcut("alt_tab")}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-surface flex items-center justify-between transition"
              >
                <span>Send Alt + Tab</span>
                <span className="font-mono text-[10px] text-on-surface-variant">Tab</span>
              </button>
              <div className="h-px bg-surface-container my-1"></div>
              <button
                onClick={() => {
                  setPrivacyMode(!privacyMode);
                  setShowActionsDropdown(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-surface flex items-center justify-between transition"
              >
                <span>Privacy Screen</span>
                <span className="text-[10px] text-secondary font-mono">{privacyMode ? "ACTIVE" : "OFF"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Tools Dropdown (File Transfer, Whiteboard, Audio, Chat) */}
        <div className="flex items-center space-x-0.5">
          {/* Audio Mute / Unmute */}
          <button
            onClick={() => {
              if (isMuted) {
                setIsMuted(false);
                if (volume === 0) setVolume(0.8);
              } else {
                setIsMuted(true);
              }
            }}
            className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            title={isMuted ? "Unmute Remote Audio" : "Mute Remote Audio"}
          >
            {isMuted || !livePermissions?.audio ? <VolumeX size={14} /> : <Volume2 size={14} className="text-secondary" />}
          </button>

          {/* Whiteboard Overlay */}
          <button
            onClick={() => setShowWhiteboard(!showWhiteboard)}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              showWhiteboard
                ? "bg-secondary-container text-white"
                : "hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface"
            }`}
            title="Interactive Whiteboard Overlay"
          >
            <PenTool size={14} />
          </button>

          {/* File Vault Drawer Trigger */}
          {livePermissions?.fileTransfer && (
            <button
              onClick={() => setShowFileTransfer(true)}
              className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              title="Open File Vault Transfer Manager"
            >
              <FolderSync size={14} />
            </button>
          )}

          {/* Chat Drawer Trigger */}
          <button
            onClick={() => {
              setShowChat(!showChat);
              if (!showChat && onResetChatCount) onResetChatCount();
            }}
            className="relative p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            title="Operator Chat"
          >
            <MessageSquare size={14} />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary-container text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadChatCount}
              </span>
            )}
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>

        <div className="w-[1px] h-3.5 bg-surface-container-highest mx-0.5"></div>

        {/* Recording Indicator */}
        <button
          onClick={toggleRecording}
          className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full transition-colors font-mono text-[11px] cursor-pointer ${
            isRecording
              ? "bg-primary-container/20 text-primary-container border border-primary-container/30"
              : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
          }`}
          title={isRecording ? "Stop Recording" : "Start Session Recording"}
        >
          <span className={`w-2 h-2 rounded-full ${isRecording ? "bg-primary-container animate-ping" : "bg-on-surface-variant"}`} />
          <span className="font-semibold">{isRecording ? "REC" : "REC"}</span>
          {isRecording && <span className="text-on-surface">{formatTimer(recordDuration)}</span>}
        </button>

        {/* Terminate Session Action */}
        <button
          onClick={onDisconnect}
          className="bg-primary-container hover:bg-inverse-primary text-white font-semibold text-xs px-3 py-1 rounded-full flex items-center gap-1 transition-all shadow-sm active:scale-95 cursor-pointer ml-1"
          title="Disconnect from remote host"
        >
          <Square size={11} className="fill-white" />
          <span>Disconnect</span>
        </button>

        {/* Pin / Collapse Grip */}
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
          className="p-1 rounded text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          title={isToolbarPinned ? "Unpin dock" : "Pin dock"}
        >
          {isToolbarPinned ? <PinOff size={13} /> : <Pin size={13} />}
        </button>
      </div>

      {/* Dynamic Permission Revoke Alert Banner */}
      {permissionNotice && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 bg-[#0F172A]/95 border border-amber-500/50 text-amber-300 px-4 py-1.5 rounded-full text-xs font-semibold shadow-2xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <ShieldAlert size={14} className="text-amber-400 shrink-0" />
          <span>{permissionNotice}</span>
        </div>
      )}

      {/* Stream Performance HUD */}
      {showStats && (
        <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-xl px-3.5 py-2 text-[11px] text-slate-300 font-mono flex items-center space-x-3 pointer-events-none z-10 shadow-2xl">
          <div className="flex items-center space-x-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                stats.packetLoss > 5
                  ? "bg-rose-500 animate-ping"
                  : stats.fps > 0
                  ? "bg-emerald-400"
                  : "bg-amber-400 animate-pulse"
              }`}
            />
            <span className="font-semibold text-white">{stats.fps > 0 ? `${stats.fps} FPS` : "Measuring..."}</span>
          </div>
          <span>•</span>
          <span>{stats.bitrate > 0 ? `${stats.bitrate} kbps` : "-- kbps"}</span>
          <span>•</span>
          <span>{stats.latency > 0 ? `${stats.latency} ms` : "-- ms"}</span>
          <span>•</span>
          <span className={stats.packetLoss > 2 ? "text-amber-400 font-bold" : "text-slate-400"}>
            Loss: {stats.packetLoss || 0}%
          </span>
          {stats.width > 0 && stats.height > 0 && (
            <>
              <span>•</span>
              <span className="text-slate-400">{stats.width}x{stats.height}</span>
            </>
          )}
          <span>•</span>
          <span className="px-1.5 py-0.5 rounded bg-[#4F46E5]/20 text-[#818CF8] text-[10px] font-bold uppercase">
            {qualityMode}
          </span>
        </div>
      )}

      {/* Subtle In-Session Overlay HUD (Bottom Right Corner) */}
      <div className="absolute bottom-4 right-4 z-40 bg-surface/90 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-3 text-on-surface font-mono text-[11px] shadow-xl border border-surface-container-highest pointer-events-none select-none">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
          <span className="text-on-surface font-semibold">Direct P2P</span>
        </div>
        <div className="w-[1px] h-3 bg-surface-container-highest"></div>
        <div className="flex items-center gap-1">
          <span className="text-on-surface-variant">BW:</span>
          <span className="text-on-surface">{stats.bitrate > 0 ? `${(stats.bitrate / 1000).toFixed(1)} Mbps` : "4.8 Mbps"}</span>
        </div>
        <div className="w-[1px] h-3 bg-surface-container-highest"></div>
        <div className="flex items-center gap-1">
          <span className="text-on-surface-variant">Loss:</span>
          <span className="text-secondary">{stats.packetLoss || 0}%</span>
        </div>
        <div className="w-[1px] h-3 bg-surface-container-highest"></div>
        <div className="flex items-center gap-1 text-tertiary">
          <span className="material-symbols-outlined text-[13px] text-secondary">shield</span>
          <span>AES-256-GCM</span>
        </div>
      </div>

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
