import React, { useState, useEffect } from "react";
import {
  Shield,
  MousePointer,
  Clipboard,
  FolderSync,
  Volume2,
  EyeOff,
  CheckCircle,
  Clock,
  Laptop,
} from "lucide-react";

export function IncomingCallModal({ callData, onAccept, onReject }) {
  const [permissions, setPermissions] = useState({
    control: true,
    clipboard: true,
    fileTransfer: true,
    audio: false,
    blockInput: false,
  });
  const [trustDevice, setTrustDevice] = useState(false);
  const [countdown, setCountdown] = useState(30);

  // Play subtle authorization notification tone
  useEffect(() => {
    let interval = null;
    const playRing = () => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        osc.frequency.setValueAtTime(650, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } catch (e) {}
    };

    playRing();
    interval = setInterval(playRing, 2500);
    return () => clearInterval(interval);
  }, []);

  // 30s Auto-decline countdown and hotkeys (Esc / Enter)
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onReject("Connection request timed out");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onReject("Dismissed via hotkey");
      } else if (e.key === "Enter") {
        onAccept(permissions);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [permissions, onAccept, onReject]);

  const togglePermission = (key) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const resetDefaults = () => {
    setPermissions({
      control: true,
      clipboard: true,
      fileTransfer: true,
      audio: false,
      blockInput: false,
    });
  };

  return (
    <div className="fixed inset-0 bg-[#0A0E17]/80 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
      <section
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[540px] bg-surface-container border border-surface-container-highest rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Top Header Card */}
        <div className="w-full bg-surface-container-high px-6 pt-5 pb-4 flex flex-col gap-3 border-b border-surface-container-highest">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center shadow-inner border border-surface-container-highest text-primary-container">
                <Shield size={20} className="fill-primary-container/20 text-primary-container" />
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-primary-container font-bold block">
                  Elevation Inbound
                </span>
                <h1 className="text-base font-semibold text-on-surface tracking-tight leading-tight">
                  Incoming Connection Request
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-dim border border-surface-container-highest rounded-full shadow-sm">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              <span className="font-mono text-[11px] text-secondary font-medium tracking-wide">LIVE PEER</span>
            </div>
          </div>

          {/* Caller Details Card */}
          <div className="w-full bg-surface-dim border border-surface-container-highest rounded-lg p-3.5 flex flex-col gap-2 shadow-inner">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Laptop size={18} className="text-tertiary" />
                <div>
                  <span className="text-xs font-semibold text-on-surface">
                    {callData?.callerAlias || "Admin-Laptop"}
                  </span>
                  <span className="text-[11px] text-tertiary ml-1.5">(Remote Client)</span>
                </div>
              </div>
              <div className="font-mono text-xs font-bold text-secondary tracking-wider bg-surface-container border border-surface-container-highest px-2.5 py-0.5 rounded">
                {callData?.callerId || "Unknown"}
              </div>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-surface-container-highest/60 text-[11px]">
              <div className="flex items-center gap-1 text-secondary">
                <CheckCircle size={13} className="text-secondary" />
                <span className="font-mono truncate max-w-[260px]">Aegis TLS 1.3 Verified Tunnel</span>
              </div>
              <span className="font-mono text-tertiary">Direct P2P Traversal</span>
            </div>
          </div>
        </div>

        {/* Privileges Matrix */}
        <div className="w-full p-5 flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-tertiary">Select privileges granted during this session:</span>
            <button
              onClick={resetDefaults}
              className="font-mono text-[11px] text-secondary hover:underline cursor-pointer bg-transparent py-0.5 px-1"
            >
              Reset Defaults
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            {/* Control Input */}
            <label
              onClick={() => togglePermission("control")}
              className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer border border-surface-container-highest/50 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded bg-surface-container flex items-center justify-center text-on-surface">
                  <MousePointer size={15} className={permissions.control ? "text-secondary" : "text-tertiary"} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-on-surface">Mouse & Keyboard Control</span>
                  <span className="text-[11px] text-tertiary">Allow remote operator to send input events</span>
                </div>
              </div>
              <div
                className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                  permissions.control ? "bg-secondary-container" : "bg-surface-dim"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    permissions.control ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </div>
            </label>

            {/* Clipboard Synchronization */}
            <label
              onClick={() => togglePermission("clipboard")}
              className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer border border-surface-container-highest/50 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded bg-surface-container flex items-center justify-center text-on-surface">
                  <Clipboard size={15} className={permissions.clipboard ? "text-secondary" : "text-tertiary"} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-on-surface">Clipboard Synchronization</span>
                  <span className="text-[11px] text-tertiary">Bidirectional text clipboard sharing</span>
                </div>
              </div>
              <div
                className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                  permissions.clipboard ? "bg-secondary-container" : "bg-surface-dim"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    permissions.clipboard ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </div>
            </label>

            {/* File Transfer */}
            <label
              onClick={() => togglePermission("fileTransfer")}
              className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer border border-surface-container-highest/50 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded bg-surface-container flex items-center justify-center text-on-surface">
                  <FolderSync size={15} className={permissions.fileTransfer ? "text-secondary" : "text-tertiary"} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-on-surface">File Transfer & Manager</span>
                  <span className="text-[11px] text-tertiary">Browse and transfer files via designated channel</span>
                </div>
              </div>
              <div
                className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                  permissions.fileTransfer ? "bg-secondary-container" : "bg-surface-dim"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    permissions.fileTransfer ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </div>
            </label>

            {/* Audio Loopback */}
            <label
              onClick={() => togglePermission("audio")}
              className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer border border-surface-container-highest/50 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded bg-surface-container flex items-center justify-center text-on-surface">
                  <Volume2 size={15} className={permissions.audio ? "text-secondary" : "text-tertiary"} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-on-surface">Audio Loopback</span>
                  <span className="text-[11px] text-tertiary">Transmit desktop audio stream to remote viewer</span>
                </div>
              </div>
              <div
                className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                  permissions.audio ? "bg-secondary-container" : "bg-surface-dim"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    permissions.audio ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </div>
            </label>

            {/* Block Input */}
            <label
              onClick={() => togglePermission("blockInput")}
              className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer border border-surface-container-highest/50 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded bg-surface-container flex items-center justify-center text-on-surface">
                  <EyeOff size={15} className={permissions.blockInput ? "text-secondary" : "text-tertiary"} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-on-surface">Block Input & Blank Screen</span>
                  <span className="text-[11px] text-tertiary">Lock local operator input during remote control</span>
                </div>
              </div>
              <div
                className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                  permissions.blockInput ? "bg-secondary-container" : "bg-surface-dim"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    permissions.blockInput ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </div>
            </label>
          </div>

          <label className="flex items-start gap-2.5 p-2 rounded-lg bg-surface-dim cursor-pointer hover:bg-surface-container-high transition-colors border border-surface-container-highest/40">
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(e) => setTrustDevice(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded bg-surface-container text-secondary-container accent-secondary cursor-pointer"
            />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-on-surface">Trust this device for automatic elevation</span>
              <span className="text-[10px] text-tertiary">Bypass this prompt for subsequent connections from this peer ID</span>
            </div>
          </label>
        </div>

        {/* Footer Actions */}
        <div className="w-full bg-surface-container-high px-6 py-3.5 flex items-center justify-between border-t border-surface-container-highest">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-tertiary">
            <Clock size={13} className="text-primary-container animate-pulse" />
            <span>
              Auto-decline in <strong className="text-primary-container font-bold">{countdown}</strong>s
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onReject("Rejected by user")}
              className="h-8 px-4 rounded-lg bg-surface-container text-on-surface hover:bg-surface-bright active:bg-surface-container-lowest text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 border border-surface-container-highest"
            >
              <span>Decline</span>
              <span className="font-mono text-tertiary text-[10px] ml-0.5">[Esc]</span>
            </button>

            <button
              onClick={() => onAccept(permissions)}
              className="h-8 px-4 rounded-lg bg-secondary-container hover:bg-emerald-600 text-white active:scale-[0.98] text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-md"
            >
              <CheckCircle size={14} className="text-white" />
              <span>Accept & Authorize</span>
              <span className="font-mono text-white/80 text-[10px] ml-0.5">[↵]</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
