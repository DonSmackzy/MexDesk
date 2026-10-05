import React, { useState, useEffect } from "react";
import {
  X,
  Lock,
  Monitor,
  Network,
  Info,
  KeyRound,
  Shield,
  Check,
  Server,
  Download,
  Power,
  ShieldCheck,
  History,
  FileSpreadsheet,
  FileJson,
  Trash2,
} from "lucide-react";
import AegisLogo from "./AegisLogo";
import { auditLogger } from "../services/AuditLogger";

export function SettingsModal({
  unattendedPassword,
  onSavePassword,
  signalingUrl,
  onSaveSignalingUrl,
  optOutDiscovery = false,
  onSaveDiscoveryOptOut,
  updatePref = "prompt",
  onSaveUpdatePref,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState("security");
  const [password, setPassword] = useState(unattendedPassword || "");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [serverUrl, setServerUrl] = useState(signalingUrl || "ws://localhost:7777");
  const [allowDiscovery, setAllowDiscovery] = useState(!optOutDiscovery);
  const [fpsLimit, setFpsLimit] = useState(localStorage.getItem("mexdesk_fps_limit") || "60");
  const [qualityProfile, setQualityProfile] = useState(localStorage.getItem("mexdesk_quality_profile") || "adaptive");
  const [localUpdatePref, setLocalUpdatePref] = useState(updatePref);
  const [savedMessage, setSavedMessage] = useState("");
  const [autoStart, setAutoStart] = useState(false);
  const [closeToTray, setCloseToTray] = useState(true);
  const [autoLockOnDisconnect, setAutoLockOnDisconnect] = useState(
    () => localStorage.getItem("aegisdesk_autolock_on_disconnect") === "true"
  );
  const [isLocking, setIsLocking] = useState(false);
  const [auditLogs, setAuditLogs] = useState(() => auditLogger.getLogs());

  useEffect(() => {
    if (activeTab === "audit") {
      setAuditLogs(auditLogger.getLogs());
    }
  }, [activeTab]);

  useEffect(() => {
    if (window.mexdeskAPI?.getAutoStart) {
      window.mexdeskAPI.getAutoStart().then((val) => setAutoStart(!!val)).catch(() => {});
    }
    if (window.mexdeskAPI?.getCloseToTray) {
      window.mexdeskAPI.getCloseToTray().then((val) => setCloseToTray(!!val)).catch(() => {});
    }
  }, []);

  const handleToggleAutoStart = async (val) => {
    setAutoStart(val);
    if (window.mexdeskAPI?.setAutoStart) {
      await window.mexdeskAPI.setAutoStart(val);
    }
  };

  const handleToggleCloseToTray = async (val) => {
    setCloseToTray(val);
    if (window.mexdeskAPI?.setCloseToTray) {
      await window.mexdeskAPI.setCloseToTray(val);
    }
  };

  const handleToggleAutoLock = (val) => {
    setAutoLockOnDisconnect(val);
    localStorage.setItem("aegisdesk_autolock_on_disconnect", val ? "true" : "false");
  };

  const handleTestLock = async () => {
    setIsLocking(true);
    if (window.mexdeskAPI?.lockWorkstation) {
      await window.mexdeskAPI.lockWorkstation();
    } else {
      alert("Lock Workstation is available in the desktop Windows application.");
    }
    setTimeout(() => setIsLocking(false), 1000);
  };

  const handleSaveSecurity = (e) => {
    e.preventDefault();
    setPasswordError("");
    // Validate confirm field only when setting a new non-empty password
    const trimmed = password.trim();
    if (trimmed && trimmed !== (unattendedPassword || "")) {
      if (trimmed !== confirmPassword.trim()) {
        setPasswordError("Passwords do not match. Please re-enter.");
        return;
      }
    }
    onSavePassword(trimmed);
    setConfirmPassword("");
    setSavedMessage(trimmed ? "Unattended access enabled!" : "Unattended access disabled.");
    setTimeout(() => setSavedMessage(""), 2500);
  };

  const handleSaveDisplay = (e) => {
    e.preventDefault();
    localStorage.setItem("mexdesk_fps_limit", fpsLimit);
    localStorage.setItem("mexdesk_quality_profile", qualityProfile);
    setSavedMessage("Display settings saved!");
    setTimeout(() => setSavedMessage(""), 2500);
  };

  const handleSaveNetwork = (e) => {
    e.preventDefault();
    onSaveSignalingUrl(serverUrl.trim());
    if (onSaveDiscoveryOptOut) {
      onSaveDiscoveryOptOut(!allowDiscovery);
    }
    if (onSaveUpdatePref) {
      onSaveUpdatePref(localUpdatePref);
    }
    setSavedMessage("Network settings updated!");
    setTimeout(() => setSavedMessage(""), 2500);
  };

  const handleExportCSV = () => {
    auditLogger.exportCSV();
    setSavedMessage("Audit trail exported as CSV");
    setTimeout(() => setSavedMessage(""), 2500);
  };

  const handleExportJSON = () => {
    auditLogger.exportJSON();
    setSavedMessage("Audit trail exported as JSON");
    setTimeout(() => setSavedMessage(""), 2500);
  };

  const handleClearLogs = () => {
    if (window.confirm("Are you sure you want to clear all security audit logs?")) {
      auditLogger.clearLogs();
      setAuditLogs([]);
      setSavedMessage("Audit logs cleared");
      setTimeout(() => setSavedMessage(""), 2500);
    }
  };

  const tabClass = (tab) =>
    `w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
      activeTab === tab
        ? "bg-[#4F46E5]/15 text-[#818CF8] border border-[#4F46E5]/30"
        : "text-slate-400 hover:bg-[#1E293B] hover:text-slate-200"
    }`;

  const inputFocusClass = "focus:outline-none focus:ring-2 focus:ring-[#818CF8]/30 focus:border-[#818CF8]";
  const btnPrimaryClass = "px-4 py-2 bg-[#818CF8] hover:bg-[#6366F1] text-slate-950 text-xs font-bold rounded-lg shadow-sm transition";

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1E293B] rounded-2xl border border-[#334155] shadow-2xl w-full max-w-2xl h-[520px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-[#334155] flex items-center justify-between bg-[#0F172A]">
          <div className="flex items-center space-x-2">
            <AegisLogo size={28} />
            <h2 className="text-sm font-bold text-white">AegisDesk Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#334155] text-slate-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Navigation */}
          <div className="w-48 bg-[#0F172A] border-r border-[#334155] p-2 space-y-1">
            <button onClick={() => setActiveTab("security")} className={tabClass("security")}>
              <Lock size={15} />
              <span>Security</span>
            </button>

            <button onClick={() => setActiveTab("display")} className={tabClass("display")}>
              <Monitor size={15} />
              <span>Display & Audio</span>
            </button>

            <button onClick={() => setActiveTab("network")} className={tabClass("network")}>
              <Network size={15} />
              <span>Network</span>
            </button>

            <button onClick={() => setActiveTab("updates")} className={tabClass("updates")}>
              <Download size={15} />
              <span>Updates</span>
            </button>

            <button onClick={() => setActiveTab("audit")} className={tabClass("audit")}>
              <History size={15} />
              <span>Audit & Logs</span>
            </button>

            <button onClick={() => setActiveTab("about")} className={tabClass("about")}>
              <Info size={15} />
              <span>About</span>
            </button>
          </div>

          {/* Right Content */}
          <div className="flex-1 p-6 overflow-y-auto bg-[#1E293B]">
            {savedMessage && (
              <div className="mb-4 p-2.5 bg-emerald-950/40 border border-emerald-800 text-emerald-400 text-xs rounded-lg flex items-center space-x-2">
                <Check size={14} />
                <span>{savedMessage}</span>
              </div>
            )}

            {/* TAB: SECURITY */}
            {activeTab === "security" && (
              <form onSubmit={handleSaveSecurity} className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                    <KeyRound size={16} className="text-[#818CF8]" />
                    <span>Unattended Access</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Allow connections without physical confirmation by setting an access password.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Access Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setPasswordError(""); }}
                      placeholder="Leave blank to disable unattended access"
                      className={`w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-xl text-xs text-white placeholder:text-slate-500 ${inputFocusClass}`}
                    />
                  </div>

                  {password.trim() && password.trim() !== (unattendedPassword || "") && (
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(""); }}
                        placeholder="Re-enter password to confirm"
                        className={`w-full px-3 py-2 bg-[#0F172A] border ${
                          passwordError ? "border-[#EF4444]" : "border-[#334155]"
                        } rounded-xl text-xs text-white placeholder:text-slate-500 ${inputFocusClass}`}
                      />
                      {passwordError && (
                        <p className="text-[11px] text-[#EF4444] mt-1.5 flex items-center gap-1">
                          <span>⚠</span> {passwordError}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="p-3 bg-[#0F172A] border border-[#334155] rounded-xl flex items-center space-x-2.5">
                    <Shield size={16} className="text-emerald-400 shrink-0" />
                    <div className="text-[11px] text-slate-400 leading-snug">
                      <strong className="text-white font-semibold block">Cryptographic Protection Active</strong>
                      Passwords are salt-hashed with scrypt and protected by automated 60s lockout after 5 failed attempts.
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#334155]/60 space-y-3">
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Power size={14} className="text-[#818CF8]" />
                      <span>24/7 Unattended Daemon & System Security</span>
                    </h4>

                    {/* Auto-Start on Windows Boot */}
                    <label className="flex items-start space-x-3 p-3 bg-[#0F172A] border border-[#334155] rounded-xl cursor-pointer hover:border-[#818CF8]/50 transition">
                      <input
                        type="checkbox"
                        checked={autoStart}
                        onChange={(e) => handleToggleAutoStart(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-[#334155] text-[#818CF8] focus:ring-[#818CF8]"
                      />
                      <div className="flex-1 text-xs">
                        <div className="font-semibold text-white">Start AegisDesk on Windows Boot</div>
                        <div className="text-slate-400 text-[11px] mt-0.5">
                          Launches minimized in the background at system startup so this server is always accessible remotely.
                        </div>
                      </div>
                    </label>

                    {/* Minimize to System Tray */}
                    <label className="flex items-start space-x-3 p-3 bg-[#0F172A] border border-[#334155] rounded-xl cursor-pointer hover:border-[#818CF8]/50 transition">
                      <input
                        type="checkbox"
                        checked={closeToTray}
                        onChange={(e) => handleToggleCloseToTray(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-[#334155] text-[#818CF8] focus:ring-[#818CF8]"
                      />
                      <div className="flex-1 text-xs">
                        <div className="font-semibold text-white">Keep Running in System Tray on Close</div>
                        <div className="text-slate-400 text-[11px] mt-0.5">
                          Closing the window hides AegisDesk to the Windows system tray daemon instead of terminating the app.
                        </div>
                      </div>
                    </label>

                    {/* Auto-Lock Workstation on Disconnect */}
                    <label className="flex items-start space-x-3 p-3 bg-[#0F172A] border border-[#334155] rounded-xl cursor-pointer hover:border-[#818CF8]/50 transition">
                      <input
                        type="checkbox"
                        checked={autoLockOnDisconnect}
                        onChange={(e) => handleToggleAutoLock(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-[#334155] text-[#818CF8] focus:ring-[#818CF8]"
                      />
                      <div className="flex-1 text-xs">
                        <div className="font-semibold text-white">Auto-Lock Workstation on Session Disconnect</div>
                        <div className="text-slate-400 text-[11px] mt-0.5">
                          Automatically triggers Windows Lock Screen (Win+L) when a remote controller ends their session.
                        </div>
                      </div>
                    </label>

                    {/* Test Lock Workstation */}
                    <div className="flex items-center justify-between p-3 bg-[#0F172A] border border-[#334155] rounded-xl">
                      <div>
                        <div className="text-xs font-semibold text-white">Lock Windows Workstation Now</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">Test native Win32 LockWorkStation injection</div>
                      </div>
                      <button
                        type="button"
                        onClick={handleTestLock}
                        disabled={isLocking}
                        className="px-3 py-1.5 bg-[#243048] hover:bg-[#2D3C5A] border border-[#334155] text-slate-200 text-xs font-semibold rounded-lg transition cursor-pointer"
                      >
                        {isLocking ? "Locking..." : "Lock Now"}
                      </button>
                    </div>
                  </div>
                </div>

                <button type="submit" className={btnPrimaryClass}>
                  Save Security Settings
                </button>
              </form>
            )}

            {/* TAB: DISPLAY */}
            {activeTab === "display" && (
              <form onSubmit={handleSaveDisplay} className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-white">Display Quality & Rendering</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Fine-tune the video stream frame rate limit and rendering priority.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Refresh Rate Limit
                    </label>
                    <select
                      value={fpsLimit}
                      onChange={(e) => setFpsLimit(e.target.value)}
                      className={`w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-xl text-xs text-white ${inputFocusClass}`}
                    >
                      <option value="60" className="bg-[#0F172A] text-white">60 FPS (Ultra Smooth - High Bandwidth)</option>
                      <option value="30" className="bg-[#0F172A] text-white">30 FPS (Balanced Bandwidth)</option>
                      <option value="15" className="bg-[#0F172A] text-white">15 FPS (Low Bandwidth Saver)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Quality Profile
                    </label>
                    <select
                      value={qualityProfile}
                      onChange={(e) => setQualityProfile(e.target.value)}
                      className={`w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-xl text-xs text-white ${inputFocusClass}`}
                    >
                      <option value="adaptive" className="bg-[#0F172A] text-white">Adaptive (Auto-balance bitrate and latency)</option>
                      <option value="crisp" className="bg-[#0F172A] text-white">Crisp Text (Optimized for documents and code)</option>
                      <option value="latency" className="bg-[#0F172A] text-white">Low Latency (Fastest mouse response)</option>
                    </select>
                  </div>
                </div>

                <button type="submit" className={btnPrimaryClass}>
                  Save Display Settings
                </button>
              </form>
            )}

            {/* TAB: NETWORK */}
            {activeTab === "network" && (
              <form onSubmit={handleSaveNetwork} className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                    <Server size={16} className="text-[#818CF8]" />
                    <span>Signaling & Relay Server</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Configure the WebSocket signaling endpoint used to route connections.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    WebSocket Server URL
                  </label>
                  <input
                    type="text"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    className={`w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-xl text-xs font-mono text-white ${inputFocusClass}`}
                  />
                </div>

                <div className="p-3 bg-[#0F172A] border border-[#334155] rounded-xl space-y-1">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowDiscovery}
                      onChange={(e) => setAllowDiscovery(e.target.checked)}
                      className="w-4 h-4 text-[#4F46E5] rounded border-slate-600 bg-[#1E293B] focus:ring-[#4F46E5]"
                    />
                    <span className="text-xs font-semibold text-white">
                      Allow LAN Discovery
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-400 pl-6.5">
                    Allow other computers running AegisDesk on the same local network / WiFi to discover this desk.
                  </p>
                </div>

                <button type="submit" className={btnPrimaryClass}>
                  Apply Network Settings
                </button>
              </form>
            )}

            {/* TAB: UPDATES */}
            {activeTab === "updates" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                    <Download size={16} className="text-[#818CF8]" />
                    <span>Update Preferences</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Choose how AegisDesk handles new version updates.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="flex items-start space-x-3 p-3 rounded-xl border border-[#334155] bg-[#0F172A] cursor-pointer hover:border-slate-500 transition">
                    <input
                      type="radio"
                      name="updatePref"
                      value="auto"
                      checked={localUpdatePref === "auto"}
                      onChange={() => {
                        setLocalUpdatePref("auto");
                        if (onSaveUpdatePref) onSaveUpdatePref("auto");
                        setSavedMessage("Update preference saved!");
                        setTimeout(() => setSavedMessage(""), 2500);
                      }}
                      className="mt-0.5 text-[#4F46E5] focus:ring-[#4F46E5]"
                    />
                    <div>
                      <span className="text-xs font-semibold text-white block">Automatically apply updates</span>
                      <span className="text-[11px] text-slate-400">
                        Updates are applied silently when the app reloads. No action needed from you.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start space-x-3 p-3 rounded-xl border border-[#334155] bg-[#0F172A] cursor-pointer hover:border-slate-500 transition">
                    <input
                      type="radio"
                      name="updatePref"
                      value="prompt"
                      checked={localUpdatePref === "prompt"}
                      onChange={() => {
                        setLocalUpdatePref("prompt");
                        if (onSaveUpdatePref) onSaveUpdatePref("prompt");
                        setSavedMessage("Update preference saved!");
                        setTimeout(() => setSavedMessage(""), 2500);
                      }}
                      className="mt-0.5 text-[#4F46E5] focus:ring-[#4F46E5]"
                    />
                    <div>
                      <span className="text-xs font-semibold text-white block">Prompt before updating</span>
                      <span className="text-[11px] text-slate-400">
                        A banner will appear when a new version is available, letting you choose when to update.
                      </span>
                    </div>
                  </label>
                </div>

                <div className="p-3 bg-[#0F172A] border border-[#334155] rounded-xl">
                  <p className="text-[11px] text-slate-400">
                    AegisDesk loads the latest UI from the cloud on each launch. Updates affect the web-layer interface. The desktop shell updates separately via new executable downloads.
                  </p>
                </div>
              </div>
            )}

            {/* TAB: AUDIT & LOGS */}
            {activeTab === "audit" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <ShieldCheck size={18} className="text-[#818CF8]" />
                      Session Audit Trail
                    </h3>
                    <p className="text-xs text-slate-400">
                      Tamper-evident session history, elevation events, and file transfer records.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleExportCSV}
                      disabled={auditLogs.length === 0}
                      className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-[#0F172A] hover:bg-[#334155] border border-[#334155] text-slate-200 text-xs font-medium rounded-lg disabled:opacity-40 transition"
                      title="Export as CSV"
                    >
                      <FileSpreadsheet size={13} className="text-emerald-400" />
                      <span>CSV</span>
                    </button>
                    <button
                      onClick={handleExportJSON}
                      disabled={auditLogs.length === 0}
                      className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-[#0F172A] hover:bg-[#334155] border border-[#334155] text-slate-200 text-xs font-medium rounded-lg disabled:opacity-40 transition"
                      title="Export as JSON"
                    >
                      <FileJson size={13} className="text-amber-400" />
                      <span>JSON</span>
                    </button>
                    <button
                      onClick={handleClearLogs}
                      disabled={auditLogs.length === 0}
                      className="p-1.5 bg-[#0F172A] hover:bg-rose-950/40 border border-[#334155] hover:border-rose-800 text-slate-400 hover:text-rose-400 rounded-lg disabled:opacity-40 transition"
                      title="Clear audit trail"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {auditLogs.length === 0 ? (
                  <div className="p-8 bg-[#0F172A] rounded-xl border border-[#334155] text-center flex flex-col items-center justify-center">
                    <History size={32} className="text-slate-600 mb-2" />
                    <p className="text-xs font-semibold text-slate-300">No session events recorded yet</p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                      When you connect, host, transfer files, or alter permissions, entries will be securely logged here.
                    </p>
                  </div>
                ) : (
                  <div className="border border-[#334155] rounded-xl overflow-hidden bg-[#0F172A]">
                    <div className="max-h-[280px] overflow-y-auto divide-y divide-[#334155]/60">
                      {auditLogs.map((log) => {
                        const dateStr = new Date(log.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        });
                        const isStart = log.type === "session_start";
                        const isEnd = log.type === "session_end";
                        const isFile = log.type === "file_transfer";
                        const isPerm = log.type === "permission_change";

                        const badgeColor = isStart
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : isEnd
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          : isFile
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          : isPerm
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-slate-500/10 text-slate-400 border-slate-500/20";

                        const label = isStart
                          ? "Connected"
                          : isEnd
                          ? "Disconnected"
                          : isFile
                          ? "Transfer"
                          : isPerm
                          ? "Permission"
                          : log.type;

                        return (
                          <div key={log.id} className="p-2.5 flex items-start justify-between text-xs hover:bg-[#1E293B]/40 transition">
                            <div className="flex items-start space-x-2.5">
                              <span className={`px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded border ${badgeColor}`}>
                                {label}
                              </span>
                              <div>
                                <div className="text-slate-200 font-medium">
                                  {log.peerAlias ? `${log.peerAlias} ` : ""}
                                  <span className="text-slate-400 font-mono text-[11px]">
                                    ({log.peerId})
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {isStart && `Role: ${log.details?.mode || "standard"}`}
                                  {isEnd && `Duration: ${log.details?.durationSeconds || 0}s (${log.details?.reason || "disconnect"})`}
                                  {isFile && `${log.details?.fileName || "file"} • ${log.details?.direction || "transfer"}`}
                                  {isPerm && `Altered: ${Object.keys(log.details?.changedPermissions || {}).join(", ")}`}
                                  {!isStart && !isEnd && !isFile && !isPerm && JSON.stringify(log.details)}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500 shrink-0">
                              {dateStr}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: ABOUT */}
            {activeTab === "about" && (
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <AegisLogo size={48} />
                  <div>
                    <h3 className="text-base font-bold text-white">AegisDesk</h3>
                    <p className="text-xs text-slate-400">Version 1.1.0</p>
                  </div>
                </div>

                <div className="p-4 bg-[#0F172A] rounded-xl border border-[#334155] text-xs text-slate-300 space-y-2">
                  <p>
                    <strong className="text-white">AegisDesk</strong> is an enterprise-grade remote desktop solution built on
                    WebRTC peer-to-peer streaming, React 18, and Electron.
                  </p>
                  <ul className="list-disc list-inside text-slate-400 space-y-1">
                    <li>End-to-End DTLS/SRTP Encryption</li>
                    <li>Sub-30ms Video Latency</li>
                    <li>Multi-Session Concurrent Connections</li>
                    <li>LAN Peer Discovery</li>
                    <li>Unattended Access with Scrypt-Hashed Passwords</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
