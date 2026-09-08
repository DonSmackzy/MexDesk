import React, { useState } from "react";
import {
  Copy,
  Check,
  ArrowRight,
  FolderSync,
  Lock,
  Monitor,
  Clock,
  Trash2,
  Shield,
  Video,
  PenTool,
  RefreshCw,
  Sparkles,
  Share2,
  Pencil,
  X,
  Tag,
} from "lucide-react";

export function HomeScreen({
  myId,
  myAlias = "",
  onSaveAlias,
  initialConnectTo = "",
  signalingUrl = "",
  onConnect,
  onFileTransferOnly,
  recentSessions,
  onRemoveRecent,
  unattendedPassword,
  onConfigurePassword,
  onOpenSettings,
}) {
  const [remoteIdInput, setRemoteIdInput] = useState(initialConnectTo || "");
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [aliasInput, setAliasInput] = useState(myAlias || "");
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [pendingRemoteId, setPendingRemoteId] = useState("");
  const [inputPassword, setInputPassword] = useState("");

  const handleCopy = () => {
    if (!myId) return;
    navigator.clipboard.writeText(myId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveAliasSubmit = (e) => {
    if (e) e.preventDefault();
    if (onSaveAlias) {
      onSaveAlias(aliasInput.trim());
    }
    setIsEditingAlias(false);
  };

  const handleCopyInviteLink = () => {
    if (!myId) return;
    const url = new URL(window.location.href);
    url.searchParams.set("connectTo", myId);
    if (signalingUrl && !signalingUrl.includes("localhost")) {
      url.searchParams.set("server", signalingUrl);
    }
    navigator.clipboard.writeText(url.toString());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleStartConnect = (type = "full-control", directId = null) => {
    const idToUse = directId || remoteIdInput.trim();
    if (!idToUse) return;

    onConnect(idToUse, type);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-6xl w-full mx-auto space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            Welcome to <span className="text-mexdesk-red">MexDesk</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Fast, secure, end-to-end encrypted remote desktop access
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onConfigurePassword}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-sm"
          >
            <Lock size={14} className={unattendedPassword ? "text-mexdesk-red" : "text-slate-400"} />
            <span>
              Unattended Access:{" "}
              <strong className={unattendedPassword ? "text-emerald-600" : "text-slate-400"}>
                {unattendedPassword ? "Enabled" : "Off"}
              </strong>
            </span>
          </button>
        </div>
      </div>

      {/* Main Connection Grid (This Desk vs Remote Desk) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* THIS DESK CARD */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-card relative overflow-hidden flex flex-col justify-between">
          {/* Top red decorative accent banner */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-mexdesk-red via-rose-500 to-mexdesk-crimson"></div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-mexdesk-lightred flex items-center justify-center text-mexdesk-red">
                  <Monitor size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">This Desk</h2>
                  <p className="text-[11px] text-slate-400">Share your ID to allow remote access</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">
                Host
              </span>
            </div>

            {/* Big 9-Digit ID & Custom Alias Display - Iconic Solid Red Card */}
            <div className="bg-gradient-to-br from-[#E52E2E] via-[#D31B1B] to-[#B71515] rounded-2xl p-5 shadow-lg shadow-red-600/25 mb-4 text-center text-white border border-red-500/40 relative overflow-hidden">
              {/* Subtle background glow effect */}
              <div className="absolute -right-8 -bottom-8 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none"></div>

              <span className="text-[11px] uppercase tracking-wider font-semibold text-red-100 block mb-1">
                Your MexDesk Address
              </span>
              <div className="text-3xl sm:text-4xl font-mono font-bold tracking-wider text-white flex items-center justify-center space-x-2 drop-shadow-sm my-1">
                {myId ? (
                  <span>{myId}</span>
                ) : (
                  <span className="text-red-200 animate-pulse">--- --- ---</span>
                )}
              </div>

              {/* Customizable Alias Row */}
              <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-center space-x-2">
                <span className="text-[11px] font-semibold text-red-100 uppercase tracking-wider">Alias:</span>
                {isEditingAlias ? (
                  <form onSubmit={handleSaveAliasSubmit} className="flex items-center space-x-1.5">
                    <input
                      type="text"
                      value={aliasInput}
                      onChange={(e) => setAliasInput(e.target.value)}
                      placeholder="e.g. boss-mezie@mex"
                      className="px-2.5 py-1 text-xs bg-white border border-white rounded-lg font-medium text-slate-900 focus:outline-none w-40 shadow-sm"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="p-1 rounded-lg bg-white text-mexdesk-red hover:bg-red-50 font-bold transition text-xs shadow-sm"
                      title="Save alias"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingAlias(false)}
                      className="p-1 rounded-lg bg-black/30 hover:bg-black/40 text-white transition text-xs"
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center space-x-1.5">
                    <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm transition shadow-inner">
                      {myAlias ? myAlias : "No alias set"}
                    </span>
                    <button
                      onClick={() => { setAliasInput(myAlias); setIsEditingAlias(true); }}
                      className="p-1 rounded-md hover:bg-white/20 text-white/90 hover:text-white transition"
                      title="Set or edit your custom alias"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopy}
                disabled={!myId}
                className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition disabled:opacity-50"
                title="Copy 9-digit address"
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-emerald-600" />
                    <span className="text-emerald-700 font-semibold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copy ID</span>
                  </>
                )}
              </button>

              <button
                onClick={handleCopyInviteLink}
                disabled={!myId}
                className="flex items-center space-x-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-mexdesk-red text-xs font-semibold rounded-lg border border-rose-200 transition disabled:opacity-50"
                title="Copy direct invite link for friends"
              >
                {copiedLink ? (
                  <>
                    <Check size={14} className="text-emerald-600" />
                    <span className="text-emerald-700">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 size={14} />
                    <span>Invite Link</span>
                  </>
                )}
              </button>

              <button
                onClick={onConfigurePassword}
                className="flex items-center space-x-1.5 px-3 py-2 border border-slate-200 hover:border-slate-300 text-slate-600 text-xs font-medium rounded-lg transition"
                title="Configure unattended access password"
              >
                <Lock size={14} />
                <span>Password</span>
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center space-x-1">
              <Shield size={12} className="text-emerald-500" />
              <span>TLS / WebRTC DTLS Encrypted</span>
            </span>
            <span>v1.0.0</span>
          </div>
        </div>

        {/* REMOTE DESK CARD */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-card relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-800"></div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                  <ArrowRight size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Remote Desk</h2>
                  <p className="text-[11px] text-slate-400">Enter 9-digit address or custom alias to connect</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-mexdesk-softred text-mexdesk-crimson text-[11px] font-medium">
                Client
              </span>
            </div>

            {/* Input form */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Remote Address or Alias
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={remoteIdInput}
                    onChange={(e) => setRemoteIdInput(e.target.value)}
                    placeholder="e.g. 482-901-325 or boss-mezie@mex"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-mono font-semibold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-mexdesk-red focus:border-transparent transition"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleStartConnect("full-control");
                    }}
                  />
                  {remoteIdInput && (
                    <button
                      onClick={() => setRemoteIdInput("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => handleStartConnect("full-control")}
                  disabled={!remoteIdInput.trim()}
                  className="flex items-center justify-center space-x-2 px-4 py-3 bg-mexdesk-red hover:bg-mexdesk-crimson active:bg-mexdesk-darkred text-white text-sm font-semibold rounded-xl shadow-md shadow-red-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>Connect</span>
                  <ArrowRight size={16} />
                </button>

                <button
                  onClick={() => handleStartConnect("file-transfer-only")}
                  disabled={!remoteIdInput.trim()}
                  className="flex items-center justify-center space-x-2 px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FolderSync size={16} className="text-slate-500" />
                  <span>Transfer Files</span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>Direct P2P with STUN fallback</span>
            <span className="text-mexdesk-red font-medium">AnyDesk Protocol Compatible</span>
          </div>
        </div>
      </div>

      {/* RECENT SESSIONS SECTION */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Clock size={16} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-800">Recent Sessions</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.2 rounded-full font-medium">
              {recentSessions.length}
            </span>
          </div>
        </div>

        {recentSessions.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Monitor size={36} className="mx-auto text-slate-200 mb-2" />
            <p className="text-xs">No recent sessions yet.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Desks you connect with will appear here for fast one-click reconnection.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {recentSessions.map((session) => (
              <div
                key={session.id}
                className="group p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-sm transition flex items-center justify-between"
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-mexdesk-red shrink-0">
                    <Monitor size={20} />
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="text-xs font-semibold text-slate-800 truncate">
                      {session.alias || "Remote Desk"}
                    </h3>
                    <p className="text-[11px] font-mono text-slate-400">{session.id}</p>
                    <span className="text-[10px] text-slate-400 block">
                      {new Date(session.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0 opacity-80 group-hover:opacity-100">
                  <button
                    onClick={() => handleStartConnect("full-control", session.id)}
                    className="p-2 rounded-lg bg-mexdesk-red hover:bg-mexdesk-crimson text-white transition shadow-sm"
                    title="Reconnect"
                  >
                    <ArrowRight size={14} />
                  </button>
                  <button
                    onClick={() => onRemoveRecent(session.id)}
                    className="p-2 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-rose-600 transition"
                    title="Remove from history"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ANYDESK COMPETITIVE ADVANTAGE FEATURE SHOWCASE */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-start space-x-3">
          <div className="p-2 rounded-lg bg-red-50 text-mexdesk-red shrink-0">
            <Video size={18} />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-800">Session Recording</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Record remote desktop streams directly to WebM format with zero CPU lag.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-start space-x-3">
          <div className="p-2 rounded-lg bg-red-50 text-mexdesk-red shrink-0">
            <PenTool size={18} />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-800">Live Whiteboard</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Annotate, draw arrows, highlight remote screens in real-time.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex items-start space-x-3">
          <div className="p-2 rounded-lg bg-red-50 text-mexdesk-red shrink-0">
            <FolderSync size={18} />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-800">Dual-Pane File Transfer</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              High-speed chunked P2P file transfers directly between devices.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
