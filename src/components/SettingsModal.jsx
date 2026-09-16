import React, { useState } from "react";
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
} from "lucide-react";
import AegisLogo from "./AegisLogo";

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
  const [serverUrl, setServerUrl] = useState(signalingUrl || "ws://localhost:7777");
  const [allowDiscovery, setAllowDiscovery] = useState(!optOutDiscovery);
  const [fpsLimit, setFpsLimit] = useState(localStorage.getItem("mexdesk_fps_limit") || "60");
  const [qualityProfile, setQualityProfile] = useState(localStorage.getItem("mexdesk_quality_profile") || "adaptive");
  const [localUpdatePref, setLocalUpdatePref] = useState(updatePref);
  const [savedMessage, setSavedMessage] = useState("");

  const handleSaveSecurity = (e) => {
    e.preventDefault();
    onSavePassword(password.trim());
    setSavedMessage("Security settings updated!");
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

  const tabClass = (tab) =>
    `w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
      activeTab === tab
        ? "bg-[#FEE2E2] text-[#DC2626] border border-red-100"
        : "text-slate-600 hover:bg-slate-100"
    }`;

  const inputFocusClass = "focus:outline-none focus:ring-2 focus:ring-[#DC2626]/30 focus:border-[#DC2626]";
  const btnPrimaryClass = "px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-semibold rounded-lg shadow-sm transition";

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl h-[520px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <AegisLogo size={28} />
            <h2 className="text-sm font-bold text-slate-800">AegisDesk Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Navigation */}
          <div className="w-48 bg-slate-50 border-r border-slate-200 p-2 space-y-1">
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

            <button onClick={() => setActiveTab("about")} className={tabClass("about")}>
              <Info size={15} />
              <span>About</span>
            </button>
          </div>

          {/* Right Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {savedMessage && (
              <div className="mb-4 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg flex items-center space-x-2">
                <Check size={14} />
                <span>{savedMessage}</span>
              </div>
            )}

            {/* TAB: SECURITY */}
            {activeTab === "security" && (
              <form onSubmit={handleSaveSecurity} className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
                    <KeyRound size={16} className="text-[#DC2626]" />
                    <span>Unattended Access</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Allow connections without physical confirmation by setting an access password.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Access Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Leave blank to disable unattended access"
                      className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 ${inputFocusClass}`}
                    />
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center space-x-2.5">
                    <Shield size={16} className="text-emerald-600 shrink-0" />
                    <div className="text-[11px] text-slate-600 leading-snug">
                      <strong className="text-slate-800 font-semibold block">Cryptographic Protection Active</strong>
                      Passwords are salt-hashed with scrypt and protected by automated 60s lockout after 5 failed attempts.
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
                  <h3 className="text-sm font-bold text-slate-800">Display Quality & Rendering</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Fine-tune the video stream frame rate limit and rendering priority.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Refresh Rate Limit
                    </label>
                    <select
                      value={fpsLimit}
                      onChange={(e) => setFpsLimit(e.target.value)}
                      className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 ${inputFocusClass}`}
                    >
                      <option value="60">60 FPS (Ultra Smooth - High Bandwidth)</option>
                      <option value="30">30 FPS (Balanced Bandwidth)</option>
                      <option value="15">15 FPS (Low Bandwidth Saver)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Quality Profile
                    </label>
                    <select
                      value={qualityProfile}
                      onChange={(e) => setQualityProfile(e.target.value)}
                      className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 ${inputFocusClass}`}
                    >
                      <option value="adaptive">Adaptive (Auto-balance bitrate and latency)</option>
                      <option value="crisp">Crisp Text (Optimized for documents and code)</option>
                      <option value="latency">Low Latency (Fastest mouse response)</option>
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
                  <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
                    <Server size={16} className="text-[#DC2626]" />
                    <span>Signaling & Relay Server</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Configure the WebSocket signaling endpoint used to route connections.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    WebSocket Server URL
                  </label>
                  <input
                    type="text"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    className={`w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 ${inputFocusClass}`}
                  />
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowDiscovery}
                      onChange={(e) => setAllowDiscovery(e.target.checked)}
                      className="w-4 h-4 text-[#DC2626] rounded border-slate-300 focus:ring-[#DC2626]"
                    />
                    <span className="text-xs font-semibold text-slate-800">
                      Allow LAN Discovery
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-500 pl-6.5">
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
                  <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
                    <Download size={16} className="text-[#DC2626]" />
                    <span>Update Preferences</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Choose how AegisDesk handles new version updates.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="flex items-start space-x-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
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
                      className="mt-0.5 text-[#DC2626] focus:ring-[#DC2626]"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">Automatically apply updates</span>
                      <span className="text-[11px] text-slate-500">
                        Updates are applied silently when the app reloads. No action needed from you.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start space-x-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
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
                      className="mt-0.5 text-[#DC2626] focus:ring-[#DC2626]"
                    />
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">Prompt before updating</span>
                      <span className="text-[11px] text-slate-500">
                        A banner will appear when a new version is available, letting you choose when to update.
                      </span>
                    </div>
                  </label>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-[11px] text-slate-500">
                    AegisDesk loads the latest UI from the cloud on each launch. Updates affect the web-layer interface. The desktop shell updates separately via new executable downloads.
                  </p>
                </div>
              </div>
            )}

            {/* TAB: ABOUT */}
            {activeTab === "about" && (
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <AegisLogo size={48} />
                  <div>
                    <h3 className="text-base font-bold text-slate-800">AegisDesk</h3>
                    <p className="text-xs text-slate-500">Version 1.1.0 (Enterprise Edition)</p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
                  <p>
                    <strong>AegisDesk</strong> is an enterprise-grade remote desktop solution built on high-performance
                    WebRTC peer-to-peer streaming, React 18, and Electron.
                  </p>
                  <ul className="list-disc list-inside text-slate-500 space-y-1">
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
