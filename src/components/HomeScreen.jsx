import React, { useState, useEffect, useRef } from "react";
import {
  Copy,
  Check,
  FolderSync,
  Lock,
  Monitor,
  Trash2,
  Shield,
  RefreshCw,
  Search,
  Star,
  QrCode,
  Laptop,
  Terminal,
  HardDrive,
  Server,
  Wifi,
  Plus,
  Play,
  Share2,
  Pencil,
  X,
  Radio,
  Activity,
  Maximize2,
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
  recentSessions = [],
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
  const [showQr, setShowQr] = useState(false);
  const [activeTab, setActiveTab] = useState("recent"); // "recent" | "fav" | "book" | "lan"
  const [filterQuery, setFilterQuery] = useState("");
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem("aegisdesk_favorites");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Address Book state
  const [addressBook, setAddressBook] = useState(() => {
    try {
      const saved = localStorage.getItem("aegisdesk_address_book");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: "addr-1", name: "Prod-DB-01", deskId: "741 892 014", os: "Win 2022", latency: "18ms", isOnline: true },
      { id: "addr-2", name: "Dev-Ubuntu-Cluster", deskId: "382 109 455", os: "Ubuntu 24", latency: "32ms", isOnline: true },
      { id: "addr-3", name: "Design-Studio-Mac", deskId: "910 442 811", os: "macOS 15", latency: "12ms", isOnline: true },
      { id: "addr-4", name: "Staging-Web-Host", deskId: "551 294 602", os: "Win 11 Pro", latency: "Offline", isOnline: false },
      { id: "addr-5", name: "Backup-NAS-Storage", deskId: "109 483 720", os: "TrueNAS", latency: "4ms (LAN)", isOnline: true },
      { id: "addr-6", name: "Finance-Workstation", deskId: "824 119 308", os: "Win 11 Ent", latency: "Offline", isOnline: false },
    ];
  });

  // Query presence periodically
  useEffect(() => {
    if (!onQueryPresence) return;
    const allIds = [
      ...addressBook.map((c) => c.deskId),
      ...recentSessions.map((s) => s.id),
    ];
    if (allIds.length > 0) {
      onQueryPresence(allIds);
      const interval = setInterval(() => onQueryPresence(allIds), 12000);
      return () => clearInterval(interval);
    }
  }, [addressBook, recentSessions, onQueryPresence]);

  const formatId = (id) => {
    if (!id) return "--- --- ---";
    const clean = id.toString().replace(/\s+/g, "");
    if (clean.length === 9) {
      return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)}`;
    }
    return clean;
  };

  const handleCopyId = () => {
    if (!myId) return;
    navigator.clipboard.writeText(myId.replace(/\s+/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartConnect = (type = "full-control", directId = null) => {
    const idToUse = (directId || remoteIdInput).trim();
    if (!idToUse) return;
    onConnect(idToUse, type);
  };

  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      localStorage.setItem("aegisdesk_favorites", JSON.stringify(next));
      return next;
    });
  };

  // Compile unified display cards for the bento grid
  const displayCards = (() => {
    if (activeTab === "book") {
      return addressBook.map((c) => ({
        id: c.deskId,
        alias: c.name,
        os: c.os || "Linux",
        latency: c.latency || (peerPresence[c.deskId]?.online ? "16ms" : "Offline"),
        isOnline: peerPresence[c.deskId]?.online ?? c.isOnline,
        isFav: favorites.includes(c.deskId),
      }));
    }

    if (activeTab === "fav") {
      const favSet = new Set(favorites);
      const bookFavs = addressBook
        .filter((c) => favSet.has(c.deskId))
        .map((c) => ({
          id: c.deskId,
          alias: c.name,
          os: c.os || "Linux",
          latency: c.latency || "18ms",
          isOnline: peerPresence[c.deskId]?.online ?? c.isOnline,
          isFav: true,
        }));
      const recentFavs = recentSessions
        .filter((s) => favSet.has(s.id))
        .map((s) => ({
          id: s.id,
          alias: s.alias || `Desk ${s.id}`,
          os: "Remote Host",
          latency: peerPresence[s.id]?.online ? "20ms" : "Offline",
          isOnline: peerPresence[s.id]?.online ?? false,
          isFav: true,
        }));
      return [...bookFavs, ...recentFavs];
    }

    if (activeTab === "lan") {
      return lanPeers.map((p) => ({
        id: p.id,
        alias: p.alias || "LAN Peer",
        os: "Local Subnet",
        latency: "2ms (LAN)",
        isOnline: true,
        isFav: favorites.includes(p.id),
      }));
    }

    // Default: Recent sessions fallback to address book if recents is empty
    if (recentSessions.length > 0) {
      return recentSessions.map((s) => ({
        id: s.id,
        alias: s.alias || `Desk ${s.id}`,
        os: "Workstation",
        latency: peerPresence[s.id]?.online ? "18ms" : "Offline",
        isOnline: peerPresence[s.id]?.online ?? false,
        isFav: favorites.includes(s.id),
      }));
    }

    return addressBook.map((c) => ({
      id: c.deskId,
      alias: c.name,
      os: c.os || "Windows",
      latency: c.latency || "18ms",
      isOnline: c.isOnline,
      isFav: favorites.includes(c.deskId),
    }));
  })().filter((card) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      card.alias.toLowerCase().includes(q) ||
      card.id.toLowerCase().includes(q) ||
      card.os.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 overflow-y-auto bg-surface-container-lowest text-on-surface p-6 font-sans select-none">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        {/* Top Two-Column Command Deck */}
        <div className="grid grid-cols-12 gap-5 items-stretch">
          {/* 1. 'This Desk' (Local Peer Node, 5 cols on lg) */}
          <div className="col-span-12 lg:col-span-5 bg-surface-container border border-surface-container-highest rounded-xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-secondary-container/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex flex-col gap-4 relative z-10">
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-secondary font-semibold">
                      Local Node
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-on-surface tracking-tight mt-0.5">This Desk</h2>
                  <span className="text-xs text-on-surface-variant">Your Address & Peer Identity</span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-surface-container-high border border-surface-container-highest flex items-center justify-center text-secondary">
                  <Radio size={16} />
                </div>
              </div>

              {/* Peer ID Display Hero Box */}
              <div className="bg-surface-container-lowest border border-surface-container-highest/60 p-4 rounded-xl flex flex-col gap-1 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase text-on-surface-variant tracking-wider font-semibold">
                    Aegis Identifier
                  </span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                    Permanent
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className="font-mono text-2xl font-bold tracking-wider text-white">
                    {formatId(myId)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleCopyId}
                      className="h-8 px-2.5 bg-surface-container hover:bg-surface-container-high border border-surface-container-highest rounded-lg text-on-surface flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Copy Peer ID"
                    >
                      {copied ? (
                        <>
                          <Check size={14} className="text-secondary" />
                          <span className="font-mono text-[11px] text-secondary font-semibold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} className="text-tertiary" />
                          <span className="font-mono text-[11px] text-on-surface font-medium">Copy</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowQr(!showQr)}
                      className="w-8 h-8 bg-surface-container hover:bg-surface-container-high border border-surface-container-highest rounded-lg text-on-surface flex items-center justify-center transition-colors cursor-pointer"
                      title="Toggle Connection QR"
                    >
                      <QrCode size={15} className="text-tertiary" />
                    </button>
                  </div>
                </div>

                {/* Dropdown QR Code */}
                {showQr && (
                  <div className="pt-3 mt-2 border-t border-surface-container-highest flex items-center gap-3 bg-surface-container-low p-2 rounded-lg animate-in fade-in">
                    <div className="w-14 h-14 bg-white p-1 rounded-lg flex items-center justify-center shrink-0">
                      <QrCode size={48} className="text-slate-900" />
                    </div>
                    <div className="flex flex-col text-[11px]">
                      <span className="font-semibold text-on-surface">Scan to Bind Mobile Client</span>
                      <span className="text-on-surface-variant text-[10px]">Aegis P2P Mobile Protocol 3.1</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Beacon Badge */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-surface-container-low border border-surface-container-highest/50 rounded-lg">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-secondary"></span>
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-on-surface leading-tight">
                      Ready for incoming connections
                    </span>
                    <span className="font-mono text-[10px] text-secondary">
                      TLS 1.3 / Direct P2P Traversal Active
                    </span>
                  </div>
                </div>
                <Shield size={16} className="text-secondary" />
              </div>

              {/* Unattended Access Control */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low border border-surface-container-highest/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-secondary-container/20 flex items-center justify-center text-secondary">
                    <Lock size={14} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-on-surface">Unattended Access</span>
                    <span className="text-[10px] text-on-surface-variant">
                      {unattendedPassword ? "Password protected" : "System service standby"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onConfigurePassword}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold transition cursor-pointer ${
                    unattendedPassword
                      ? "bg-secondary-container text-white"
                      : "bg-surface-container-high text-on-surface-variant hover:text-white"
                  }`}
                >
                  {unattendedPassword ? "ENABLED" : "CONFIGURE"}
                </button>
              </div>
            </div>

            {/* Local Mini Telemetry Strip */}
            <div className="mt-4 pt-2 flex items-center justify-between text-on-surface-variant font-mono text-[10px] bg-surface-container-lowest border border-surface-container-highest/40 px-3 py-1.5 rounded-lg">
              <div className="flex items-center gap-1.5">
                <Server size={12} className="text-tertiary" />
                <span>Alias: <strong className="text-on-surface">{myAlias || "Aegis Host"}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <HardDrive size={12} className="text-tertiary" />
                <span>Port: <strong className="text-secondary">7070</strong> UDP/TCP</span>
              </div>
            </div>
          </div>

          {/* 2. 'Remote Desk' (Connect to Partner Node, 7 cols on lg) */}
          <div className="col-span-12 lg:col-span-7 bg-surface-container border border-surface-container-highest rounded-xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden">
            <div className="absolute -right-16 -bottom-16 w-60 h-60 bg-primary-container/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex flex-col gap-4 relative z-10">
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-primary-container font-semibold">
                      Initiate Session
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-on-surface tracking-tight mt-0.5">Remote Desk</h2>
                  <span className="text-xs text-on-surface-variant">
                    Connect to Partner Node, Relay or Terminal
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-surface-container-low border border-surface-container-highest px-2.5 py-1 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  <span className="font-mono text-[10px] text-on-surface">Auto Codec: AV1 / H.265</span>
                </div>
              </div>

              {/* Main Connection Input Box */}
              <div className="flex flex-col gap-1.5 mt-1">
                <label className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant flex items-center justify-between">
                  <span>Target Desk ID or Domain Alias</span>
                  <span className="text-tertiary">Press Enter ↵ to Connect</span>
                </label>
                <div className="relative flex items-center bg-surface-container-lowest border border-surface-container-highest rounded-xl shadow-inner focus-within:ring-2 focus-within:ring-primary-container transition-all">
                  <Terminal size={17} className="absolute left-3.5 text-on-surface-variant" />
                  <input
                    type="text"
                    value={remoteIdInput}
                    onChange={(e) => setRemoteIdInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleStartConnect()}
                    placeholder="Enter Remote Desk ID or Alias (e.g. 741 892 014 or office-pc)"
                    className="w-full h-11 bg-transparent pl-11 pr-28 font-mono text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none"
                  />
                  <div className="absolute right-1.5 flex items-center gap-1">
                    <button
                      onClick={() => handleStartConnect()}
                      className="h-8 px-4 bg-primary-container hover:bg-inverse-primary text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      <Play size={12} className="fill-white" />
                      <span>Connect</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Connection Mode Action Strip */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <button
                  onClick={() => onFileTransferOnly?.(remoteIdInput.trim())}
                  className="h-7 px-3 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-surface-container-highest/60"
                >
                  <FolderSync size={13} className="text-tertiary" />
                  <span>File Transfer Only</span>
                </button>
                <button
                  onClick={() => handleStartConnect("view-only")}
                  className="h-7 px-3 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-surface-container-highest/60"
                >
                  <Monitor size={13} className="text-tertiary" />
                  <span>View Mode Only</span>
                </button>
              </div>

              {/* Fast-Pick Quick Peers */}
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
                  Fast-Pick Quick Peers
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {["Prod-DB-01", "MacBook-Pro-M3", "Dev-Ubuntu-02"].map((peer) => (
                    <button
                      key={peer}
                      onClick={() => setRemoteIdInput(peer)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container-low hover:bg-surface-container-high border border-surface-container-highest/60 text-on-surface transition cursor-pointer text-xs"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                      <span className="font-mono text-[11px]">{peer}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Protocol & Cipher Strip */}
            <div className="mt-4 pt-2 flex items-center justify-between text-on-surface-variant font-mono text-[10px] bg-surface-container-lowest border border-surface-container-highest/40 px-3 py-1.5 rounded-lg">
              <div className="flex items-center gap-1.5">
                <Shield size={12} className="text-secondary" />
                <span>Tunnel: ChaCha20-Poly1305 + AES-256</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>Buffer: Direct Frame Latency &lt; 8ms</span>
              </div>
            </div>
          </div>
        </div>

        {/* Lower Section: Address Book & Recents Workspace */}
        <div className="bg-surface-container border border-surface-container-highest rounded-xl p-5 flex flex-col gap-4 shadow-xl">
          {/* Filter & Category Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* Category Navigation Tabs */}
            <div className="flex items-center gap-1 bg-surface-container-lowest p-1 rounded-lg border border-surface-container-highest/60">
              <button
                onClick={() => setActiveTab("recent")}
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === "recent"
                    ? "bg-surface-container-high text-white shadow-sm"
                    : "text-on-surface-variant hover:text-white"
                }`}
              >
                <span>Recent Sessions</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 bg-surface-container-highest rounded-full">
                  {recentSessions.length || 6}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("fav")}
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === "fav"
                    ? "bg-surface-container-high text-white shadow-sm"
                    : "text-on-surface-variant hover:text-white"
                }`}
              >
                <Star size={12} className="text-amber-400 fill-amber-400" />
                <span>Favorites</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 bg-surface-container-highest rounded-full">
                  {favorites.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("book")}
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === "book"
                    ? "bg-surface-container-high text-white shadow-sm"
                    : "text-on-surface-variant hover:text-white"
                }`}
              >
                <span>Address Book</span>
              </button>

              {lanPeers.length > 0 && (
                <button
                  onClick={() => setActiveTab("lan")}
                  className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                    activeTab === "lan"
                      ? "bg-surface-container-high text-white shadow-sm"
                      : "text-on-surface-variant hover:text-white"
                  }`}
                >
                  <Wifi size={12} className="text-secondary" />
                  <span>LAN ({lanPeers.length})</span>
                </button>
              )}
            </div>

            {/* Search Filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64 bg-surface-container-lowest border border-surface-container-highest/60 rounded-lg flex items-center px-2.5 py-1">
                <Search size={14} className="text-on-surface-variant mr-1.5" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filter hosts, aliases, IPs..."
                  className="w-full bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Bento Grid (2x3 Hosts) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayCards.map((card) => {
              const isFav = favorites.includes(card.id);
              return (
                <div
                  key={card.id}
                  className="group relative bg-surface-container-low border border-surface-container-highest/60 rounded-xl p-4 flex flex-col justify-between shadow-md hover:shadow-xl hover:border-surface-container-highest transition-all duration-150 overflow-hidden"
                >
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-on-surface shrink-0">
                          <Laptop size={16} />
                        </div>
                        <div className="flex flex-col truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-on-surface truncate">
                              {card.alias}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(card.id);
                              }}
                              className="text-amber-400 hover:scale-110 transition cursor-pointer"
                            >
                              <Star size={12} className={isFav ? "fill-amber-400" : "text-slate-600"} />
                            </button>
                          </div>
                          <span className="font-mono text-[11px] text-on-surface-variant">
                            ID: {formatId(card.id)}
                          </span>
                        </div>
                      </div>

                      {/* Live Latency Beacon */}
                      <div
                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                          card.isOnline
                            ? "bg-secondary/10 text-secondary"
                            : "bg-error-container/20 text-error"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            card.isOnline ? "bg-secondary animate-pulse" : "bg-error"
                          }`}
                        />
                        <span>{card.latency}</span>
                      </div>
                    </div>

                    {/* Metrics Strip */}
                    <div className="grid grid-cols-3 gap-1 bg-surface-container-lowest border border-surface-container-highest/40 p-2 rounded-lg text-center mt-1 text-[10px]">
                      <div className="flex flex-col">
                        <span className="font-mono text-on-surface-variant uppercase text-[9px]">OS</span>
                        <span className="font-mono text-on-surface font-semibold truncate">{card.os}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-mono text-on-surface-variant uppercase text-[9px]">Display</span>
                        <span className="font-mono text-on-surface font-semibold">1080p 60Hz</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-mono text-on-surface-variant uppercase text-[9px]">Tunnel</span>
                        <span className="font-mono text-secondary font-semibold">
                          {card.isOnline ? "P2P Direct" : "Standby"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-surface-container-highest/50 flex items-center justify-between text-on-surface-variant text-[11px]">
                    <span>Last active: recently</span>
                    <span className="font-mono text-[10px]">AES-256-GCM</span>
                  </div>

                  {/* Hover Action Overlay */}
                  <div className="absolute inset-0 bg-surface-dim/95 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-4">
                    <button
                      onClick={() => handleStartConnect("full-control", card.id)}
                      className="h-8 px-4 bg-primary-container hover:bg-inverse-primary text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md transition-transform active:scale-95 cursor-pointer"
                    >
                      <Play size={12} className="fill-white" />
                      <span>Connect Now</span>
                    </button>
                    <button
                      onClick={() => onFileTransferOnly?.(card.id)}
                      className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-bright text-on-surface flex items-center justify-center transition cursor-pointer border border-surface-container-highest"
                      title="File Transfer"
                    >
                      <FolderSync size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Telemetry Status Strip Footer */}
        <footer className="bg-surface-container border border-surface-container-highest rounded-xl px-4 py-2.5 flex flex-col md:flex-row items-center justify-between gap-2 shadow-md text-[11px] font-mono text-on-surface-variant">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-secondary"></span>
              <span className="text-on-surface font-semibold">Direct Connection</span>
              <span>(P2P NAT Traversal STUN/TURN OK)</span>
            </div>
            <span className="text-surface-bright">|</span>
            <div className="flex items-center gap-1">
              <span>Public IP:</span>
              <span className="text-on-surface font-semibold">203.0.113.45</span>
            </div>
            <span className="text-surface-bright">|</span>
            <div className="flex items-center gap-1">
              <span>Engine:</span>
              <span className="text-secondary font-semibold">Aegis Engine v4.2.0</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-secondary-container/20 text-secondary border border-secondary-container/30">
              Status: 100% Operational
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
