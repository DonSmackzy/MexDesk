import React, { useState, useEffect, useRef } from "react";
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
  BookOpen,
  Plus,
  Upload,
  Download,
  Search,
  Server,
  HardDrive,
  Users,
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
  peerPresence = {},
  onQueryPresence,
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

  // Address Book & Categorized Presence State
  const [addressBook, setAddressBook] = useState(() => {
    try {
      const saved = localStorage.getItem("aegisdesk_address_book");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: "addr-1",
        name: "Production Server",
        deskId: "482-901-325",
        group: "Work Servers",
        notes: "Primary Cloud Windows Server",
      },
      {
        id: "addr-2",
        name: "Office Workstation",
        deskId: "512-349-881",
        group: "Office PCs",
        notes: "Headquarters Desktop",
      },
      {
        id: "addr-3",
        name: "Home Lab NAS",
        deskId: "773-102-490",
        group: "Home Lab",
        notes: "Media & Storage Server",
      },
    ];
  });
  const [selectedGroup, setSelectedGroup] = useState("All");
  const [addressBookSearch, setAddressBookSearch] = useState("");
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState(null);
  const [contactFormName, setContactFormName] = useState("");
  const [contactFormDeskId, setContactFormDeskId] = useState("");
  const [contactFormGroup, setContactFormGroup] = useState("Work Servers");
  const [contactFormCustomGroup, setContactFormCustomGroup] = useState("");
  const [contactFormNotes, setContactFormNotes] = useState("");
  const [addressBookMessage, setAddressBookMessage] = useState("");
  const importFileRef = useRef(null);

  useEffect(() => {
    if (!onQueryPresence || !addressBook.length) return;
    const deskIds = addressBook.map((c) => c.deskId);
    onQueryPresence(deskIds);

    const interval = setInterval(() => {
      onQueryPresence(deskIds);
    }, 12000);

    return () => clearInterval(interval);
  }, [activeSessionsTab, addressBook, onQueryPresence]);

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

  const PRESET_GROUPS = ["All", "Work Servers", "Office PCs", "Home Lab", "Clients"];
  const allGroups = Array.from(new Set([...PRESET_GROUPS, ...addressBook.map((c) => c.group).filter(Boolean)]));

  const filteredContacts = addressBook.filter((contact) => {
    const matchesGroup = selectedGroup === "All" || contact.group === selectedGroup;
    const q = addressBookSearch.trim().toLowerCase();
    if (!q) return matchesGroup;
    const matchesSearch =
      (contact.name && contact.name.toLowerCase().includes(q)) ||
      (contact.deskId && contact.deskId.toLowerCase().includes(q)) ||
      (contact.notes && contact.notes.toLowerCase().includes(q)) ||
      (contact.group && contact.group.toLowerCase().includes(q));
    return matchesGroup && matchesSearch;
  });

  const handleOpenAddContact = () => {
    setEditingContactId(null);
    setContactFormName("");
    setContactFormDeskId("");
    setContactFormGroup("Work Servers");
    setContactFormCustomGroup("");
    setContactFormNotes("");
    setIsContactModalOpen(true);
  };

  const handleOpenEditContact = (contact) => {
    setEditingContactId(contact.id);
    setContactFormName(contact.name || "");
    setContactFormDeskId(contact.deskId || "");
    if (["Work Servers", "Office PCs", "Home Lab", "Clients"].includes(contact.group)) {
      setContactFormGroup(contact.group);
      setContactFormCustomGroup("");
    } else {
      setContactFormGroup("Custom");
      setContactFormCustomGroup(contact.group || "");
    }
    setContactFormNotes(contact.notes || "");
    setIsContactModalOpen(true);
  };

  const handleSaveContactSubmit = (e) => {
    e.preventDefault();
    const name = contactFormName.trim();
    const deskId = contactFormDeskId.trim();
    if (!name || !deskId) return;

    const group =
      contactFormGroup === "Custom"
        ? contactFormCustomGroup.trim() || "Custom"
        : contactFormGroup;

    if (editingContactId) {
      setAddressBook((prev) => {
        const next = prev.map((c) =>
          c.id === editingContactId
            ? { ...c, name, deskId, group, notes: contactFormNotes.trim() }
            : c
        );
        localStorage.setItem("aegisdesk_address_book", JSON.stringify(next));
        return next;
      });
      setAddressBookMessage("Contact updated successfully!");
    } else {
      const newContact = {
        id: "addr-" + Date.now(),
        name,
        deskId,
        group,
        notes: contactFormNotes.trim(),
      };
      setAddressBook((prev) => {
        const next = [newContact, ...prev];
        localStorage.setItem("aegisdesk_address_book", JSON.stringify(next));
        return next;
      });
      setAddressBookMessage("New contact added to Address Book!");
    }

    setTimeout(() => setAddressBookMessage(""), 2500);
    setIsContactModalOpen(false);
    if (onQueryPresence) {
      setTimeout(() => onQueryPresence([deskId]), 300);
    }
  };

  const handleDeleteContact = (contactId) => {
    setAddressBook((prev) => {
      const next = prev.filter((c) => c.id !== contactId);
      localStorage.setItem("aegisdesk_address_book", JSON.stringify(next));
      return next;
    });
    setAddressBookMessage("Contact removed.");
    setTimeout(() => setAddressBookMessage(""), 2500);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(addressBook, null, 2));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = `aegisdesk-addressbook-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setAddressBookMessage("Address book exported to JSON!");
    setTimeout(() => setAddressBookMessage(""), 2500);
  };

  const handleImportJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((c) => c && c.name && c.deskId);
          if (valid.length > 0) {
            setAddressBook(valid);
            localStorage.setItem("aegisdesk_address_book", JSON.stringify(valid));
            setAddressBookMessage(`Imported ${valid.length} contacts successfully!`);
            if (onQueryPresence) {
              onQueryPresence(valid.map((c) => c.deskId));
            }
          } else {
            setAddressBookMessage("No valid contacts found in JSON.");
          }
        } else {
          setAddressBookMessage("Invalid address book JSON format.");
        }
      } catch (err) {
        setAddressBookMessage("Failed to parse JSON file.");
      }
      setTimeout(() => setAddressBookMessage(""), 3000);
    };
    reader.readAsText(file);
    e.target.value = "";
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

            {/* Tab: Address Book */}
            <button
              onClick={() => setActiveSessionsTab("addressbook")}
              className={`flex items-center space-x-2 pb-1 font-semibold text-xs transition border-b-2 cursor-pointer ${
                activeSessionsTab === "addressbook"
                  ? "border-[#818CF8] text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <BookOpen size={15} />
              <span>Address Book</span>
              <span className="text-[11px] bg-[#4F46E5] text-white px-2 py-0.5 rounded-full font-medium">
                {addressBook.length}
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

          {activeSessionsTab === "addressbook" && (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleOpenAddContact}
                className="flex items-center space-x-1 px-2.5 py-1 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-sm"
              >
                <Plus size={13} />
                <span>Add Contact</span>
              </button>

              <button
                onClick={handleExportJSON}
                className="flex items-center space-x-1 px-2.5 py-1 bg-[#243048] hover:bg-[#2D3C5A] text-slate-300 border border-[#334155] rounded-lg text-xs font-medium transition cursor-pointer"
                title="Export address book to JSON backup"
              >
                <Download size={13} />
                <span>Export</span>
              </button>

              <button
                onClick={() => importFileRef.current?.click()}
                className="flex items-center space-x-1 px-2.5 py-1 bg-[#243048] hover:bg-[#2D3C5A] text-slate-300 border border-[#334155] rounded-lg text-xs font-medium transition cursor-pointer"
                title="Import address book from JSON backup"
              >
                <Upload size={13} />
                <span>Import</span>
              </button>
              <input
                ref={importFileRef}
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />

              {onQueryPresence && (
                <button
                  onClick={() => onQueryPresence(addressBook.map((c) => c.deskId))}
                  className="p-1.5 text-slate-400 hover:text-[#818CF8] transition cursor-pointer"
                  title="Check live presence status"
                >
                  <RefreshCw size={13} />
                </button>
              )}
            </div>
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

        {/* TAB CONTENT: ADDRESS BOOK */}
        {activeSessionsTab === "addressbook" && (
          <div className="space-y-4">
            {addressBookMessage && (
              <div className="p-2.5 bg-emerald-950/40 border border-emerald-800 text-emerald-400 text-xs rounded-lg flex items-center space-x-2">
                <Check size={14} />
                <span>{addressBookMessage}</span>
              </div>
            )}

            {/* Address Book Filters: Groups & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
              {/* Group filter chips */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {allGroups.map((grp) => {
                  const count =
                    grp === "All"
                      ? addressBook.length
                      : addressBook.filter((c) => c.group === grp).length;
                  const isSelected = selectedGroup === grp;
                  return (
                    <button
                      key={grp}
                      onClick={() => setSelectedGroup(grp)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center space-x-1.5 ${
                        isSelected
                          ? "bg-[#4F46E5] text-white shadow-sm"
                          : "bg-[#0F172A] text-slate-400 hover:text-white border border-[#334155]"
                      }`}
                    >
                      <span>{grp}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          isSelected ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search input */}
              <div className="relative min-w-[200px] max-w-xs">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={addressBookSearch}
                  onChange={(e) => setAddressBookSearch(e.target.value)}
                  placeholder="Filter by name, ID, or tag..."
                  className="w-full pl-8 pr-3 py-1.5 bg-[#0F172A] border border-[#334155] rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#818CF8] focus:ring-1 focus:ring-[#818CF8] transition"
                />
                {addressBookSearch && (
                  <button
                    onClick={() => setAddressBookSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Contacts Grid */}
            {filteredContacts.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <div className="w-12 h-12 rounded-full bg-[#0F172A] border border-[#334155] text-slate-400 flex items-center justify-center mx-auto mb-2">
                  <BookOpen size={22} />
                </div>
                <h3 className="text-xs font-semibold text-slate-300">No contacts found</h3>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                  {addressBook.length === 0
                    ? "Add bookmarks for your remote workstations, cloud servers, or client desks."
                    : "No bookmarks match your search or selected group filter."}
                </p>
                <button
                  onClick={handleOpenAddContact}
                  className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-sm"
                >
                  <Plus size={13} />
                  <span>Add First Contact</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filteredContacts.map((contact) => {
                  const presence = peerPresence[contact.deskId];
                  const isOnline = !!presence?.online;

                  return (
                    <div
                      key={contact.id}
                      className="group p-3.5 rounded-xl border border-[#334155] bg-[#243048]/40 hover:bg-[#243048] hover:border-[#818CF8]/50 transition flex flex-col justify-between"
                    >
                      <div>
                        {/* Top: Group Tag and Live Status */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#1E293B] border border-[#334155] text-[#818CF8]">
                            {contact.group || "Work Servers"}
                          </span>

                          {/* Live Presence Indicator - Offline is bright red (#EF4444) */}
                          {isOnline ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#16A34A]/20 text-[#16A34A] border border-[#16A34A]/30">
                              <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse"></span>
                              <span>Online</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30">
                              <span className="w-2 h-2 rounded-full bg-[#EF4444]"></span>
                              <span>Offline</span>
                            </span>
                          )}
                        </div>

                        {/* Name and Desk ID */}
                        <div className="flex items-center space-x-2.5 mb-2">
                          <div className="w-9 h-9 rounded-lg bg-[#0F172A] border border-[#334155] flex items-center justify-center text-[#818CF8] shrink-0">
                            {contact.group === "Work Servers" ? (
                              <Server size={18} />
                            ) : contact.group === "Home Lab" ? (
                              <HardDrive size={18} />
                            ) : (
                              <Monitor size={18} />
                            )}
                          </div>
                          <div className="overflow-hidden flex-1 min-w-0">
                            <h3 className="text-xs font-bold text-white truncate" title={contact.name}>
                              {contact.name}
                            </h3>
                            <p className="text-[11px] font-mono text-slate-400 truncate">
                              {contact.deskId}
                            </p>
                          </div>
                        </div>

                        {contact.notes && (
                          <p className="text-[11px] text-slate-400 line-clamp-1 mb-2 italic">
                            {contact.notes}
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#334155]/60 mt-2">
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleOpenEditContact(contact)}
                            className="p-1.5 text-slate-400 hover:text-[#818CF8] hover:bg-[#1E293B] rounded-lg transition cursor-pointer"
                            title="Edit contact"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteContact(contact.id)}
                            className="p-1.5 text-slate-400 hover:text-[#EF4444] hover:bg-[#3F1D28] rounded-lg transition cursor-pointer"
                            title="Delete bookmark"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => handleStartConnect("file-transfer-only", contact.deskId)}
                            className="p-1.5 text-slate-300 hover:text-white bg-[#1E293B] hover:bg-[#253248] border border-[#334155] rounded-lg text-xs transition cursor-pointer"
                            title="Transfer files"
                          >
                            <FolderSync size={13} />
                          </button>
                          <button
                            onClick={() => handleStartConnect("full-control", contact.deskId)}
                            className="flex items-center space-x-1 px-3 py-1 bg-[#818CF8] hover:bg-[#6366F1] text-slate-950 font-bold text-xs rounded-lg shadow-sm transition cursor-pointer"
                          >
                            <span>Connect</span>
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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

      {/* ADD / EDIT CONTACT MODAL */}
      {isContactModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#1E293B] rounded-2xl border border-[#334155] shadow-2xl w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#334155] pb-3">
              <div className="flex items-center space-x-2">
                <BookOpen size={18} className="text-[#818CF8]" />
                <h3 className="text-sm font-bold text-white">
                  {editingContactId ? "Edit Contact" : "Add Address Book Entry"}
                </h3>
              </div>
              <button
                onClick={() => setIsContactModalOpen(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveContactSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Device / Contact Name *
                </label>
                <input
                  type="text"
                  required
                  value={contactFormName}
                  onChange={(e) => setContactFormName(e.target.value)}
                  placeholder="e.g. Production Web Server"
                  className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#818CF8] focus:ring-1 focus:ring-[#818CF8]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  AegisDesk ID or Alias *
                </label>
                <input
                  type="text"
                  required
                  value={contactFormDeskId}
                  onChange={(e) => setContactFormDeskId(e.target.value)}
                  placeholder="e.g. 482-901-325 or boss-mezie@aegis"
                  className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-xl text-xs text-white placeholder:text-slate-500 font-mono focus:outline-none focus:border-[#818CF8] focus:ring-1 focus:ring-[#818CF8]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Category / Group
                </label>
                <select
                  value={contactFormGroup}
                  onChange={(e) => setContactFormGroup(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-xl text-xs text-white focus:outline-none focus:border-[#818CF8]"
                >
                  <option value="Work Servers" className="bg-[#0F172A] text-white">Work Servers</option>
                  <option value="Office PCs" className="bg-[#0F172A] text-white">Office PCs</option>
                  <option value="Home Lab" className="bg-[#0F172A] text-white">Home Lab</option>
                  <option value="Clients" className="bg-[#0F172A] text-white">Clients</option>
                  <option value="Custom" className="bg-[#0F172A] text-white">Custom Group...</option>
                </select>

                {contactFormGroup === "Custom" && (
                  <input
                    type="text"
                    value={contactFormCustomGroup}
                    onChange={(e) => setContactFormCustomGroup(e.target.value)}
                    placeholder="Enter custom category name..."
                    className="mt-2 w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#818CF8]"
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={contactFormNotes}
                  onChange={(e) => setContactFormNotes(e.target.value)}
                  placeholder="e.g. AWS EC2 Windows instance"
                  className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#818CF8]"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#334155]">
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
                >
                  {editingContactId ? "Save Changes" : "Add to Address Book"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
