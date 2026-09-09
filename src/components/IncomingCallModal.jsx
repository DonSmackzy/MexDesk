import React, { useState, useEffect } from "react";
import {
  Monitor,
  ShieldCheck,
  Check,
  X,
  MousePointer,
  FolderSync,
  Clipboard,
  Volume2,
  ShieldAlert
} from "lucide-react";

export function IncomingCallModal({ callData, onAccept, onReject }) {
  const [permissions, setPermissions] = useState({
    control: true,
    fileTransfer: true,
    clipboard: true,
    audio: true,
  });

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

  const togglePermission = (key) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header Banner - AnyDesk Style Connection Authorization Header */}
        <div className="bg-gradient-to-r from-mexdesk-red to-mexdesk-crimson p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center relative">
              <Monitor size={22} className="text-white" />
              <ShieldCheck size={12} className="text-emerald-300 absolute -bottom-1 -right-1 bg-mexdesk-crimson rounded-full" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider font-semibold opacity-80">
                Incoming Connection Request
              </span>
              <h2 className="text-lg font-bold">Remote Desktop Access</h2>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Caller Details Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-center">
            <span className="text-xs text-slate-400 block mb-1 font-medium">Connecting ID</span>
            <div className="text-2xl font-mono font-bold text-slate-800 tracking-wider">
              {callData?.callerId || "Unknown"}
            </div>
            <span className="text-xs text-slate-500 font-medium mt-0.5 block">
              {callData?.callerAlias || "Remote User"}
            </span>
          </div>

          {/* Granular Permissions */}
          <div>
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-2">
              Permissions Granted
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label
                onClick={() => togglePermission("control")}
                className={`flex items-center space-x-2 p-2.5 rounded-lg border cursor-pointer select-none transition ${
                  permissions.control
                    ? "bg-rose-50 border-rose-200 text-slate-800"
                    : "bg-slate-50 border-slate-200 text-slate-400"
                }`}
              >
                <MousePointer size={15} className={permissions.control ? "text-mexdesk-red" : "text-slate-400"} />
                <span className="font-medium">Control Input</span>
              </label>

              <label
                onClick={() => togglePermission("fileTransfer")}
                className={`flex items-center space-x-2 p-2.5 rounded-lg border cursor-pointer select-none transition ${
                  permissions.fileTransfer
                    ? "bg-rose-50 border-rose-200 text-slate-800"
                    : "bg-slate-50 border-slate-200 text-slate-400"
                }`}
              >
                <FolderSync size={15} className={permissions.fileTransfer ? "text-mexdesk-red" : "text-slate-400"} />
                <span className="font-medium">File Transfer</span>
              </label>

              <label
                onClick={() => togglePermission("clipboard")}
                className={`flex items-center space-x-2 p-2.5 rounded-lg border cursor-pointer select-none transition ${
                  permissions.clipboard
                    ? "bg-rose-50 border-rose-200 text-slate-800"
                    : "bg-slate-50 border-slate-200 text-slate-400"
                }`}
              >
                <Clipboard size={15} className={permissions.clipboard ? "text-mexdesk-red" : "text-slate-400"} />
                <span className="font-medium">Sync Clipboard</span>
              </label>

              <label
                onClick={() => togglePermission("audio")}
                className={`flex items-center space-x-2 p-2.5 rounded-lg border cursor-pointer select-none transition ${
                  permissions.audio
                    ? "bg-rose-50 border-rose-200 text-slate-800"
                    : "bg-slate-50 border-slate-200 text-slate-400"
                }`}
              >
                <Volume2 size={15} className={permissions.audio ? "text-mexdesk-red" : "text-slate-400"} />
                <span className="font-medium">Transmit Audio</span>
              </label>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-lg">
            <ShieldAlert size={14} className="shrink-0 text-amber-600" />
            <span>Only accept connections from people and devices you trust.</span>
          </div>

          {/* Accept / Reject Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => onAccept(permissions)}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-sm rounded-xl shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              <Check size={18} />
              <span>Accept</span>
            </button>

            <button
              onClick={() => onReject("Rejected by user")}
              className="flex items-center justify-center space-x-2 px-4 py-3 bg-mexdesk-red hover:bg-mexdesk-crimson active:bg-mexdesk-darkred text-white font-semibold text-sm rounded-xl shadow-md shadow-red-500/20 transition cursor-pointer"
            >
              <X size={18} />
              <span>Dismiss</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
