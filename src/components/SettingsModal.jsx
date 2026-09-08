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
  Server
} from "lucide-react";

export function SettingsModal({
  unattendedPassword,
  onSavePassword,
  signalingUrl,
  onSaveSignalingUrl,
  onClose
}) {
  const [activeTab, setActiveTab] = useState("security");
  const [password, setPassword] = useState(unattendedPassword || "");
  const [serverUrl, setServerUrl] = useState(signalingUrl || "ws://localhost:7777");
  const [savedMessage, setSavedMessage] = useState("");

  const handleSaveSecurity = (e) => {
    e.preventDefault();
    onSavePassword(password.trim());
    setSavedMessage("Security settings updated!");
    setTimeout(() => setSavedMessage(""), 2500);
  };

  const handleSaveNetwork = (e) => {
    e.preventDefault();
    onSaveSignalingUrl(serverUrl.trim());
    setSavedMessage("Network settings updated!");
    setTimeout(() => setSavedMessage(""), 2500);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl h-[520px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-mexdesk-red text-white flex items-center justify-center font-bold text-xs">
              M
            </div>
            <h2 className="text-sm font-bold text-slate-800">MexDesk Settings</h2>
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
            <button
              onClick={() => setActiveTab("security")}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === "security"
                  ? "bg-rose-50 text-mexdesk-red border border-rose-100"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Lock size={15} />
              <span>Security</span>
            </button>

            <button
              onClick={() => setActiveTab("display")}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === "display"
                  ? "bg-rose-50 text-mexdesk-red border border-rose-100"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Monitor size={15} />
              <span>Display & Audio</span>
            </button>

            <button
              onClick={() => setActiveTab("network")}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === "network"
                  ? "bg-rose-50 text-mexdesk-red border border-rose-100"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Network size={15} />
              <span>Network</span>
            </button>

            <button
              onClick={() => setActiveTab("about")}
              className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                activeTab === "about"
                  ? "bg-rose-50 text-mexdesk-red border border-rose-100"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
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
                    <KeyRound size={16} className="text-mexdesk-red" />
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
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-mexdesk-red"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="twofa"
                      className="rounded text-mexdesk-red focus:ring-mexdesk-red"
                      defaultChecked
                    />
                    <label htmlFor="twofa" className="text-xs text-slate-700">
                      Require interactive confirmation if password is entered incorrectly
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-mexdesk-red hover:bg-mexdesk-crimson text-white text-xs font-semibold rounded-lg shadow-sm transition"
                >
                  Save Security Settings
                </button>
              </form>
            )}

            {/* TAB: DISPLAY */}
            {activeTab === "display" && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Display Quality & Rendering</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Fine-tune the video stream codec and refresh rates.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Refresh Rate Limit
                    </label>
                    <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800">
                      <option>60 FPS (Ultra Smooth)</option>
                      <option>30 FPS (Balanced Bandwidth)</option>
                      <option>15 FPS (Low Bandwidth Saver)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Quality Profile
                    </label>
                    <select className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800">
                      <option>Adaptive (Auto-balance bitrate and latency)</option>
                      <option>Crisp Text (Optimized for documents and code)</option>
                      <option>Low Latency (Fastest mouse response)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: NETWORK */}
            {activeTab === "network" && (
              <form onSubmit={handleSaveNetwork} className="space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
                    <Server size={16} className="text-mexdesk-red" />
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-mexdesk-red"
                  />
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-mexdesk-red hover:bg-mexdesk-crimson text-white text-xs font-semibold rounded-lg shadow-sm transition"
                >
                  Apply Network Settings
                </button>
              </form>
            )}

            {/* TAB: ABOUT */}
            {activeTab === "about" && (
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-2xl bg-mexdesk-red flex items-center justify-center text-white font-bold text-xl shadow-md">
                    M
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">MexDesk</h3>
                    <p className="text-xs text-slate-500">Version 1.0.0 (Red & White Edition)</p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
                  <p>
                    <strong>MexDesk</strong> is a next-generation AnyDesk alternative built on high-performance
                    WebRTC peer-to-peer streaming, React 18, and Electron.
                  </p>
                  <ul className="list-disc list-inside text-slate-500 space-y-1">
                    <li>End-to-End DTLS/SRTP Encryption</li>
                    <li>Sub-30ms Video Latency</li>
                    <li>Dual-Pane File Transfer</li>
                    <li>Interactive Live Whiteboard Annotation</li>
                    <li>Zero-Lag Session Recording</li>
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
