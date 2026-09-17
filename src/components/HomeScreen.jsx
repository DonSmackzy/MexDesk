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
  AlertCircle,
  Wifi,
} from "lucide-react";
import AegisLogo from "./AegisLogo";

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
  onRenameRecent,
  unattendedPassword,
  onConfigurePassword,
  onOpenSettings,
  lanPeers = [],
  onRefreshLanPeers,
}) {
  const [remoteIdInput, setRemoteIdInput] = useState(initialConnectTo || "");
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [aliasInput, setAliasInput] = useState(myAlias || "");
  const [editingRecentId, setEditingRecentId] = useState(null);
  const [editingRecentAliasInput, setEditingRecentAliasInput] = useState("");
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [pendingRemoteId, setPendingRemoteId] = useState("");
  const [inputPassword, setInputPassword] = useState("");
  const [activeSessionsTab, setActiveSessionsTab] = useState(() => {
    return lanPeers.length > 0 && (!recentSessions || recentSessions.length === 0)
      ? "discovered"
      : "recent";
  });

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
    <div className="flex-1 overflow-y-auto p-6 max-w-6xl w-full mx-auto space-y-6 text-slate-100">
      {/* Top Bar with Unattended Access Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AegisLogo size={32} />
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              AegisDesk
            </h1>
            <p className="text-xs text-slate-400">
              Enterprise-grade, secure, ultra-low latency remote desktop access
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onConfigurePassword}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-[#1E293B] border border-[#334155] rounded-xl hover:bg-[#253248] hover:text-white transition shadow-sm"
          >
            <Lock size={14} className={unattendedPassword ? "text-[#818CF8]" : "text-slate-400"} />
            <span>
              Unattended Access:{" "}
              <strong className={unattendedPassword ? "text-[#16A34A]" : "text-slate-400"}>
                {unattendedPassword ? "Enabled" : "Off"}
              </strong>
            </span>
          </button>
        </div>
      </div>

      {/* Informative Browser Sandbox Indicator Banner */}
      {typeof window !== "undefined" && !window.mexdeskAPI?.isElectron && (
        <div className="bg-[#1E293B] border border-amber-500/40 rounded-2xl p-4 flex items-start space-x-3 text-amber-200 shadow-sm animate-in fade-in duration-200">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
            <AlertCircle size={20} />
          </div>
          <div className="text-xs space-y-1">
            <h4 className="font-semibold text-white">
              Running in Web Browser Mode
            </h4>
            <p className="text-slate-300 leading-relaxed">
              Standard web browsers operate inside an OS security sandbox: Chrome/Edge requires picking a screen to share and restricts websites from simulating native Windows mouse clicks.
            </p>
            <p className="text-amber-300 font-medium">
              💡 For 1-click seamless screen sharing and full native mouse & keyboard remote control, run the <strong>AegisDesk Desktop App</strong> on the host PC (<code className="bg-slate-900 px-1 py-0.5 rounded font-mono text-[11px] border border-[#334155]">npm run electron:start</code>).
            </p>
          </div>
        </div>
      )}

      {/* Main Connection Grid (This Desk vs Remote Desk) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* THIS DESK CARD */}
        <div className="bg-[#1E293B] rounded-2xl p-6 border border-[#334155] shadow-card relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-[#243048] flex items-center justify-center text-[#818CF8]">
                  <Monitor size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">This Desk</h2>
                  <p className="text-[11px] text-slate-400">Share your ID to allow remote access</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#243048] text-slate-300 text-[11px] font-medium">
                Host
              </span>
            </div>

            {/* Big 9-Digit ID & Custom Alias Display - Iconic Indigo Card */}
            <div className="bg-[#818CF8] rounded-2xl p-5 shadow-lg shadow-indigo-950/40 mb-4 text-center text-white relative overflow-hidden">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-indigo-100 block mb-1">
                Your AegisDesk Address
              </span>
              <div className="text-3xl sm:text-4xl font-mono font-bold tracking-wider text-white flex items-center justify-center space-x-2 drop-shadow-sm my-1">
                {myId ? (
                  <span>{myId}</span>
                ) : (
                  <span className="text-indigo-200 animate-pulse">--- --- ---</span>
                )}
              </div>

              {/* Customizable Alias Row */}
              <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-center space-x-2">
                <span className="text-[11px] font-semibold text-indigo-100 uppercase tracking-wider">Alias:</span>
                {isEditingAlias ? (
                  <form onSubmit={handleSaveAliasSubmit} className="flex items-center space-x-1.5">
                    <input
                      type="text"
                      value={aliasInput}
                      onChange={(e) => setAliasInput(e.target.value)}
                      placeholder="e.g. boss-mezie@aegis"
                      className="px-2.5 py-1 text-xs bg-white border border-white rounded-lg font-medium text-slate-900 focus:outline-none w-40 shadow-sm"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="p-1 rounded-lg bg-white text-[#4F46E5] hover:bg-slate-100 font-bold transition text-xs shadow-sm"
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
                className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-[#243048] hover:bg-[#2D3C5A] text-slate-200 border border-[#334155] text-xs font-medium rounded-lg transition disabled:opacity-50"
                title="Copy 9-digit address"
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-[#16A34A]" />
                    <span className="text-[#16A34A] font-semibold">Copied!</span>
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
                className="flex items-center space-x-1.5 px-4 py-2 bg-[#818CF8] hover:bg-[#6366F1] text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                title="Copy direct invite link for friends"
              >
                {copiedLink ? (
                  <>
                    <Check size={14} className="text-white" />
                    <span className="text-white">Link Copied!</span>
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
                className="flex items-center space-x-1.5 px-3 py-2 bg-[#243048] hover:bg-[#2D3C5A] text-slate-200 border border-[#334155] text-xs font-medium rounded-lg transition"
                title="Configure unattended access password"
              >
                <Lock size={14} />
                <span>Password</span>
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#334155]/60 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center space-x-1.5">
              <Shield size={12} className="text-[#16A34A]" />
              <span className="text-emerald-400">TLS / WebRTC DTLS Encrypted</span>
            </span>
            <span className="text-slate-500">v1.0.0</span>
          </div>
        </div>

        {/* REMOTE DESK CARD */}
        <div className="bg-[#1E293B] rounded-2xl p-6 border border-[#334155] shadow-card relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-[#243048] flex items-center justify-center text-[#818CF8]">
                  <ArrowRight size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Remote Desk</h2>
                  <p className="text-[11px] text-slate-400">Enter 9-digit address or custom alias to connect</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#243048] text-slate-300 text-[11px] font-medium">
                Client
              </span>
            </div>

            {/* Input form */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Remote Address or Alias
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={remoteIdInput}
                    onChange={(e) => setRemoteIdInput(e.target.value)}
                    placeholder="e.g. 482-901-325 or boss-mezie@aegis"
                    className="w-full px-4 py-3 bg-[#0F172A] border border-[#334155] rounded-xl text-base font-mono font-semibold text-white placeholder:text-slate-500 focus:outline-none focus:border-[#818CF8] focus:ring-1 focus:ring-[#818CF8] transition"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleStartConnect("full-control");
                    }}
                  />
                  {remoteIdInput && (
                    <button
                      onClick={() => setRemoteIdInput("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
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
                  className="flex items-center justify-center space-x-2 px-4 py-3 bg-[#818CF8] hover:bg-[#6366F1] active:bg-[#4F46E5] text-white text-sm font-semibold rounded-xl shadow-md shadow-indigo-950/40 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <span>Connect</span>
                  <ArrowRight size={16} />
                </button>

                <button
                  onClick={() => handleStartConnect("file-transfer-only")}
                  disabled={!remoteIdInput.trim()}
                  className="flex items-center justify-center space-x-2 px-4 py-3 bg-[#243048] hover:bg-[#2D3C5A] border border-[#334155] text-slate-200 text-sm font-semibold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FolderSync size={16} className="text-slate-400" />
                  <span>Transfer Files</span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#334155]/60 flex items-center justify-between text-[11px] text-slate-400">
            <span>Direct P2P with STUN fallback</span>
            <span>Standard RDP-compatible</span>
          </div>
        </div>
      </div>

      {/* SESSIONS & LAN DISCOVERY SECTION */}
      <div className="bg-[#1E293B] rounded-2xl p-6 border border-[#334155] shadow-card">
        <div className="flex items-center justify-between mb-4 border-b border-[#334155]/60 pb-3">
          <div className="flex items-center space-x-4">
            {/* Tab: Recent Sessions */}
            <button
              onClick={() => setActiveSessionsTab("recent")}
              className={`flex items-center space-x-2 pb-1 font-semibold text-xs transition border-b-2 cursor-pointer ${
                activeSessionsTab === "recent"
                  ? "border-[#818CF8] text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Clock size={15} />
              <span>Recent Sessions</span>
              <span className="text-[11px] bg-[#4F46E5] text-white px-2 py-0.5 rounded-full font-medium">
                {recentSessions.length}
              </span>
            </button>

            {/* Tab: Discovered on Network */}
            <button
              onClick={() => setActiveSessionsTab("discovered")}
              className={`flex items-center space-x-2 pb-1 font-semibold text-xs transition border-b-2 cursor-pointer ${
                activeSessionsTab === "discovered"
                  ? "border-[#818CF8] text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Wifi size={15} className={lanPeers.length > 0 ? "text-[#16A34A]" : ""} />
              <span>Discovered</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  lanPeers.length > 0
                    ? "bg-[#16A34A]/20 text-[#16A34A] font-bold animate-pulse"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {lanPeers.length}
              </span>
            </button>
          </div>

          {activeSessionsTab === "discovered" && onRefreshLanPeers && (
            <button
              onClick={onRefreshLanPeers}
              className="flex items-center space-x-1 text-xs text-slate-400 hover:text-[#818CF8] transition cursor-pointer"
              title="Rescan local network for AegisDesk clients"
            >
              <RefreshCw size={13} />
              <span>Rescan Network</span>
            </button>
          )}
        </div>

        {/* TAB CONTENT: DISCOVERED ON LOCAL NETWORK */}
        {activeSessionsTab === "discovered" && (
          lanPeers.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <div className="w-12 h-12 rounded-full bg-[#0F172A] border border-[#334155] text-slate-400 flex items-center justify-center mx-auto mb-2">
                <Wifi size={24} />
              </div>
              <h3 className="text-xs font-semibold text-slate-300">No other AegisDesk devices found on this network</h3>
              <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                Open AegisDesk on another computer connected to your local network or WiFi. It will automatically be detected and listed here for instant connection.
              </p>
              {onRefreshLanPeers && (
                <button
                  onClick={onRefreshLanPeers}
                  className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#243048] hover:bg-[#2D3C5A] text-slate-200 border border-[#334155] rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  <RefreshCw size={12} />
                  <span>Scan Again</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {lanPeers.map((peer) => (
                <div
                  key={peer.id}
                  className="group p-3 rounded-xl border border-[#334155] bg-[#243048]/40 hover:bg-[#243048] hover:border-[#16A34A]/50 transition flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3 overflow-hidden flex-1 min-w-0 mr-2">
                    <div className="relative w-10 h-10 rounded-lg bg-emerald-500/20 text-[#16A34A] border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <Monitor size={20} />
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#16A34A] border-2 border-[#1E293B] animate-pulse"></span>
                    </div>

                    <div className="overflow-hidden flex-1 min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <h3 className="text-xs font-bold text-white truncate">
                          {peer.alias || "AegisDesk Client"}
                        </h3>
                        <span className="text-[9px] bg-emerald-500/20 text-[#16A34A] font-bold px-1.5 py-0.2 rounded border border-emerald-500/30">
                          LAN
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 font-semibold">{peer.id}</p>
                      <span className="text-[10px] text-emerald-400 font-medium block">
                        Online • Same Network
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => handleStartConnect("full-control", peer.id)}
                      className="px-3 py-1.5 rounded-lg bg-[#818CF8] hover:bg-[#6366F1] text-white text-xs font-semibold transition shadow-sm flex items-center space-x-1 cursor-pointer"
                      title="Connect to this LAN desk"
                    >
                      <span>Connect</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* TAB CONTENT: RECENT SESSIONS */}
        {activeSessionsTab === "recent" && (
          recentSessions.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Monitor size={36} className="mx-auto text-slate-600 mb-2" />
              <p className="text-xs text-slate-300">No recent sessions yet.</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Desks you connect with will appear here for fast one-click reconnection.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {recentSessions.map((session) => {
                const isEditingThis = editingRecentId === session.id;

                return (
                  <div
                    key={session.id}
                    className="group p-3 rounded-xl border border-[#334155]/60 bg-[#243048]/40 hover:bg-[#243048] hover:border-[#334155] transition flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3 overflow-hidden flex-1 min-w-0 mr-2">
                      <div className="w-10 h-10 rounded-lg bg-[#1E293B] border border-[#334155] flex items-center justify-center text-[#818CF8] shrink-0">
                        <Monitor size={20} />
                      </div>

                      <div className="overflow-hidden flex-1 min-w-0">
                        {isEditingThis ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (onRenameRecent) {
                                onRenameRecent(session.id, editingRecentAliasInput);
                              }
                              setEditingRecentId(null);
                            }}
                            className="flex items-center space-x-1"
                          >
                            <input
                              type="text"
                              autoFocus
                              value={editingRecentAliasInput}
                              onChange={(e) => setEditingRecentAliasInput(e.target.value)}
                              placeholder="Remote Desk Alias"
                              className="w-full px-2 py-0.5 text-xs bg-[#0F172A] border border-[#818CF8] rounded font-medium text-white focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="p-1 text-[#16A34A] hover:text-emerald-300 font-bold text-xs cursor-pointer"
                              title="Save Alias"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingRecentId(null)}
                              className="p-1 text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
                              title="Cancel"
                            >
                              <X size={13} />
                            </button>
                          </form>
                        ) : (
                          <div>
                            <div className="flex items-center space-x-1.5 group/alias">
                              <h3 className="text-xs font-semibold text-white truncate">
                                {session.alias || "Remote Desk"}
                              </h3>
                              <button
                                onClick={() => {
                                  setEditingRecentId(session.id);
                                  setEditingRecentAliasInput(session.alias || `Desk ${session.id}`);
                                }}
                                className="opacity-0 group-hover/alias:opacity-100 p-0.5 text-slate-400 hover:text-[#818CF8] transition cursor-pointer"
                                title="Rename remote client alias"
                              >
                                <Pencil size={11} />
                              </button>
                            </div>
                            <p className="text-[11px] font-mono text-slate-400">{session.id}</p>
                            <span className="text-[10px] text-slate-500 block">
                              {new Date(session.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {/* Connect arrow button - Indigo */}
                      <button
                        onClick={() => handleStartConnect("full-control", session.id)}
                        className="p-2 rounded-lg bg-[#818CF8] hover:bg-[#6366F1] text-white transition shadow-sm cursor-pointer"
                        title="Connect"
                      >
                        <ArrowRight size={14} />
                      </button>
                      {/* Delete button - Reserved Red */}
                      <button
                        onClick={() => onRemoveRecent(session.id)}
                        className="p-2 rounded-lg bg-[#3F1D28] hover:bg-[#542030] text-[#EF4444] border border-[#EF4444]/30 transition shadow-sm cursor-pointer"
                        title="Remove from history"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* FEATURE SHOWCASE CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#1E293B] border border-[#334155] shadow-sm flex items-start space-x-3">
          <div className="p-2 rounded-lg bg-[#243048] text-[#818CF8] shrink-0">
            <Video size={18} />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white">Session Recording</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Record remote desktop streams directly to WebM format with zero CPU lag.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#1E293B] border border-[#334155] shadow-sm flex items-start space-x-3">
          <div className="p-2 rounded-lg bg-[#243048] text-[#818CF8] shrink-0">
            <PenTool size={18} />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white">Live Whiteboard</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Annotate, draw arrows, highlight remote screens in real-time.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#1E293B] border border-[#334155] shadow-sm flex items-start space-x-3">
          <div className="p-2 rounded-lg bg-[#243048] text-[#818CF8] shrink-0">
            <FolderSync size={18} />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white">Dual-Pane File Transfer</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              High-speed chunked P2P file transfers directly between devices.
            </p>
          </div>
        </div>
      </div>

      {/* COLOR SYSTEM (Exact specification from design reference) */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-2xl p-4 shadow-sm">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
          Color System
        </h4>
        <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs font-medium">
          <div className="flex items-center space-x-2">
            <span className="w-3.5 h-3.5 rounded-full bg-[#4F46E5] inline-block shadow-sm"></span>
            <span className="text-slate-300">Primary <span className="font-mono text-slate-400 font-normal">#4F46E5</span></span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3.5 h-3.5 rounded-full bg-[#4338CA] inline-block shadow-sm"></span>
            <span className="text-slate-300">Hover / active <span className="font-mono text-slate-400 font-normal">#4338CA</span></span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3.5 h-3.5 rounded-full bg-[#EEF2FF] inline-block shadow-sm border border-slate-600"></span>
            <span className="text-slate-300">Tint (chips, bg) <span className="font-mono text-slate-400 font-normal">#EEF2FF</span></span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3.5 h-3.5 rounded-full bg-[#16A34A] inline-block shadow-sm"></span>
            <span className="text-slate-300">Online / success <span className="font-mono text-slate-400 font-normal">#16A34A</span> <span className="text-slate-500 font-normal">— unchanged</span></span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3.5 h-3.5 rounded-full bg-[#EF4444] inline-block shadow-sm"></span>
            <span className="text-slate-300">Destructive only <span className="font-mono text-slate-400 font-normal">#EF4444</span> <span className="text-slate-500 font-normal">— reserved</span></span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3.5 h-3.5 rounded-full bg-[#0F172A] inline-block shadow-sm border border-slate-600"></span>
            <span className="text-slate-300">Ink / text <span className="font-mono text-slate-400 font-normal">#0F172A</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
