import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Upload,
  Download,
  Folder,
  File,
  FileText,
  Image,
  Film,
  Music,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Pause,
  RefreshCw,
  Search,
  HardDrive,
  Laptop,
  Terminal,
} from "lucide-react";
import { FileTransferEngine } from "../services/FileTransferEngine";

export function FileTransferModal({ webrtc, targetPeerId, onClose }) {
  const fileInputRef = useRef(null);
  const [engine, setEngine] = useState(null);

  // Active transfers
  const [transfers, setTransfers] = useState([]);
  const [selectedLocalFiles, setSelectedLocalFiles] = useState([]);
  const [filterQuery, setFilterQuery] = useState("");

  // Staged local and remote file lists
  const [localFiles, setLocalFiles] = useState([
    { name: "backup.zip", size: 126248576, type: "ZIP Archive", modified: "Today 14:22" },
    { name: "docker-compose.yml", size: 2867, type: "YAML File", modified: "Today 11:05" },
    { name: "nginx.conf", size: 4198, type: "Config", modified: "Yesterday" },
    { name: "ssl_cert.pem", size: 1945, type: "Cert Key", modified: "3 days ago" },
    { name: "deployment_notes.md", size: 12288, type: "Markdown", modified: "4 days ago" },
  ]);

  const [remoteFiles, setRemoteFiles] = useState([
    { name: "build_202610", size: 0, isDir: true, perms: "drwxr-xr-x", modified: "Oct 18" },
    { name: "logs", size: 0, isDir: true, perms: "drwxrwxr-x", modified: "Today 04:00" },
    { name: "package.json", size: 1433, perms: "-rw-r--r--", modified: "Oct 12" },
    { name: "server.js", size: 19046, perms: "-rwxr-xr-x", modified: "Oct 14" },
    { name: ".env.production", size: 911, perms: "-rw-------", modified: "Oct 10" },
    { name: "ecosystem.config.js", size: 3276, perms: "-rw-r--r--", modified: "Oct 09" },
  ]);

  useEffect(() => {
    if (!webrtc) return;
    const ftEngine = new FileTransferEngine(webrtc);
    setEngine(ftEngine);

    ftEngine.on("transfer-started", (data) => {
      setTransfers((prev) => [
        ...prev.filter((t) => t.id !== data.id),
        { ...data, progress: 0, status: "transferring", speed: "12.4 MB/s", eta: "00:00:06" },
      ]);
    });

    ftEngine.on("transfer-progress", (data) => {
      setTransfers((prev) =>
        prev.map((t) => (t.id === data.id ? { ...t, ...data, status: "transferring" } : t))
      );
    });

    ftEngine.on("transfer-complete", (data) => {
      setTransfers((prev) =>
        prev.map((t) => (t.id === data.id ? { ...t, progress: 100, status: "completed" } : t))
      );

      if (data.blob) {
        const url = URL.createObjectURL(data.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.name;
        a.click();
        URL.revokeObjectURL(url);

        setRemoteFiles((prev) => [
          { name: data.name, size: data.blob.size, perms: "-rw-r--r--", modified: "Just now" },
          ...prev,
        ]);
      }
    });

    return () => {
      ftEngine.destroy();
    };
  }, [webrtc]);

  const handleSelectLocalFile = (name) => {
    setSelectedLocalFiles((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleNativeFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !engine) return;

    for (const file of files) {
      setLocalFiles((prev) => [
        { name: file.name, size: file.size, type: "Uploaded File", modified: "Just now" },
        ...prev,
      ]);
      await engine.sendFile(file);
    }
  };

  const handleSendSelected = async () => {
    if (!engine || selectedLocalFiles.length === 0) return;
    // Simulate sending selected queued files
    const selected = localFiles.find((f) => selectedLocalFiles.includes(f.name));
    if (selected) {
      setTransfers((prev) => [
        {
          id: Date.now().toString(),
          name: selected.name,
          size: selected.size,
          progress: 15,
          status: "transferring",
          speed: "12.4 MB/s",
          eta: "00:00:06",
        },
        ...prev,
      ]);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "--";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getFileIcon = (name, isDir) => {
    if (isDir) return <Folder size={15} className="text-primary-container" />;
    if (name.match(/\.(png|jpg|jpeg|svg|webp)$/i)) return <Image size={15} className="text-secondary" />;
    if (name.match(/\.(mp4|mkv|webm)$/i)) return <Film size={15} className="text-purple-400" />;
    if (name.match(/\.(mp3|wav)$/i)) return <Music size={15} className="text-amber-400" />;
    if (name.match(/\.(pdf|docx?|txt|md)$/i)) return <FileText size={15} className="text-blue-400" />;
    return <File size={15} className="text-tertiary" />;
  };

  const activeTransfer = transfers.find((t) => t.status === "transferring") || (transfers.length > 0 ? transfers[0] : null);

  return (
    <div className="fixed inset-0 bg-[#0A0E17]/85 backdrop-blur-md z-50 flex items-center justify-center p-6 select-none">
      <div className="bg-surface-container rounded-xl border border-surface-container-highest shadow-2xl w-full max-w-5xl h-[620px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Session Bar / Header */}
        <div className="flex flex-col bg-surface-dim px-4 py-2.5 gap-2 border-b border-surface-container-highest shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-6 h-6 rounded bg-secondary-container text-white">
                <span className="material-symbols-outlined text-[15px]">sync_alt</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-xs text-on-surface">
                <span className="text-tertiary">Active File Session:</span>
                <span className="px-1.5 py-0.5 rounded bg-surface-container font-semibold text-secondary">
                  This PC
                </span>
                <span className="material-symbols-outlined text-[14px] text-tertiary">swap_horiz</span>
                <span className="px-1.5 py-0.5 rounded bg-surface-container font-semibold text-on-surface">
                  Remote PC
                </span>
                <span className="text-on-surface-variant font-mono">({targetPeerId})</span>
              </div>
              <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded bg-surface-container-low text-secondary font-mono text-[11px] border border-surface-container-highest/60">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                <span>AES-256-GCM / Direct P2P (0.4ms)</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleNativeFilesSelected}
              />
              <div className="flex items-center bg-surface-container-lowest border border-surface-container-highest rounded px-2.5 py-1 gap-1.5">
                <Search size={13} className="text-tertiary" />
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filter files..."
                  className="bg-transparent text-on-surface placeholder:text-surface-bright font-mono text-xs focus:outline-none w-36"
                />
              </div>
              <button
                onClick={handleUploadClick}
                className="flex items-center gap-1 px-3 py-1 bg-secondary-container hover:bg-emerald-600 text-white rounded text-xs font-semibold shadow-sm transition cursor-pointer"
                title="Stage and Send Files"
              >
                <Upload size={13} />
                <span>Upload</span>
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Quick Targets Strip */}
          <div className="flex items-center gap-3 pt-0.5 text-on-surface-variant text-xs">
            <span className="font-mono text-[10px] uppercase tracking-wider text-tertiary">Quick Targets:</span>
            <div className="flex items-center gap-1 text-[11px]">
              <button className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-surface-container hover:text-on-surface transition">
                <Laptop size={12} />
                <span>Desktop</span>
              </button>
              <button className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-surface-container hover:text-on-surface transition">
                <Download size={12} />
                <span>Downloads</span>
              </button>
              <button className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-surface-container hover:text-on-surface transition">
                <FileText size={12} />
                <span>Documents</span>
              </button>
              <button className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-surface-container hover:text-on-surface transition">
                <HardDrive size={12} />
                <span>C:\ Root</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dual-Pane Core Workspace */}
        <div className="flex flex-1 min-h-0 bg-surface-container-lowest divide-x divide-surface-container-highest">
          {/* Left Pane: Local File Tree */}
          <section className="flex flex-col flex-1 min-w-0 bg-surface-dim">
            <div className="flex items-center justify-between px-3 py-1.5 bg-surface-container-low border-b border-surface-container-highest">
              <div className="flex items-center gap-1.5 min-w-0">
                <Laptop size={14} className="text-tertiary shrink-0" />
                <span className="text-xs font-semibold text-on-surface shrink-0">This PC (Local)</span>
                <div className="flex items-center gap-0.5 ml-2 bg-surface-container-lowest px-1.5 py-0.5 rounded font-mono text-[11px] text-on-surface truncate border border-surface-container-highest/40">
                  <span className="text-tertiary">C:\</span>
                  <span>Users\Administrator\</span>
                  <span className="text-secondary font-semibold">Deployments\</span>
                </div>
              </div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 px-3 py-1 bg-surface-container font-mono text-[10px] uppercase tracking-wider text-tertiary select-none border-b border-surface-container-highest/60">
              <div className="col-span-6 flex items-center gap-1">
                <span>Name</span>
              </div>
              <div className="col-span-2 text-right">Size</div>
              <div className="col-span-2 pl-2">Type</div>
              <div className="col-span-2 text-right">Modified</div>
            </div>

            {/* Local File List */}
            <div className="flex-1 overflow-y-auto font-sans text-xs text-on-surface divide-y divide-surface-container-low/30">
              {localFiles
                .filter((f) => f.name.toLowerCase().includes(filterQuery.toLowerCase()))
                .map((file) => {
                  const isSelected = selectedLocalFiles.includes(file.name);
                  return (
                    <div
                      key={file.name}
                      onClick={() => handleSelectLocalFile(file.name)}
                      className={`grid grid-cols-12 px-3 py-1.5 cursor-pointer items-center transition-colors ${
                        isSelected
                          ? "bg-surface-container-highest text-white font-medium"
                          : "hover:bg-surface-container-high text-on-surface"
                      }`}
                    >
                      <div className="col-span-6 flex items-center gap-2 truncate">
                        {getFileIcon(file.name, file.isDir)}
                        <span className="truncate">{file.name}</span>
                        {isSelected && (
                          <span className="px-1 rounded bg-primary-container text-white font-mono text-[9px]">
                            SELECTED
                          </span>
                        )}
                      </div>
                      <div className="col-span-2 text-right font-mono text-[11px] text-tertiary">
                        {formatBytes(file.size)}
                      </div>
                      <div className="col-span-2 pl-2 text-[11px] text-on-surface-variant truncate">
                        {file.type}
                      </div>
                      <div className="col-span-2 text-right font-mono text-[11px] text-on-surface-variant">
                        {file.modified}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="flex items-center justify-between px-3 py-1 bg-surface-container-low font-mono text-[11px] text-on-surface-variant border-t border-surface-container-highest">
              <span>{localFiles.length} items</span>
              <span>NTFS Local Storage</span>
            </div>
          </section>

          {/* Middle Vertical Action Island */}
          <div className="w-14 bg-surface-container-lowest flex flex-col items-center justify-center gap-2 z-10 shrink-0">
            <button
              onClick={handleSendSelected}
              className="w-10 h-10 rounded-lg bg-primary-container hover:bg-inverse-primary text-white flex flex-col items-center justify-center transition-all transform active:scale-95 shadow-md cursor-pointer"
              title="Upload Selected to Remote (Send)"
            >
              <ArrowRight size={16} />
              <span className="font-mono text-[8px] uppercase font-bold tracking-tighter">Send</span>
            </button>
            <button
              className="w-10 h-10 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface flex flex-col items-center justify-center transition-all transform active:scale-95 shadow-sm cursor-pointer"
              title="Download Selected to Local (Fetch)"
            >
              <ArrowLeft size={16} />
              <span className="font-mono text-[8px] uppercase font-bold tracking-tighter">Fetch</span>
            </button>
            <div className="w-5 h-px bg-surface-container my-1"></div>
            <button
              className="w-7 h-7 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-secondary flex items-center justify-center transition-colors cursor-pointer"
              title="Sync Directories"
            >
              <RefreshCw size={13} />
            </button>
          </div>

          {/* Right Pane: Remote File Tree */}
          <section className="flex flex-col flex-1 min-w-0 bg-surface-dim">
            <div className="flex items-center justify-between px-3 py-1.5 bg-surface-container-low border-b border-surface-container-highest">
              <div className="flex items-center gap-1.5 min-w-0">
                <Terminal size={14} className="text-secondary shrink-0" />
                <span className="text-xs font-semibold text-on-surface shrink-0">Remote PC ({targetPeerId})</span>
                <div className="flex items-center gap-0.5 ml-2 bg-surface-container-lowest px-1.5 py-0.5 rounded font-mono text-[11px] text-on-surface truncate border border-surface-container-highest/40">
                  <span className="text-tertiary">/</span>
                  <span>var/www/</span>
                  <span className="text-secondary font-semibold">production/</span>
                </div>
              </div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 px-3 py-1 bg-surface-container font-mono text-[10px] uppercase tracking-wider text-tertiary select-none border-b border-surface-container-highest/60">
              <div className="col-span-5 flex items-center gap-1">
                <span>Remote Name</span>
              </div>
              <div className="col-span-2 text-right">Size</div>
              <div className="col-span-3 text-center">Perms</div>
              <div className="col-span-2 text-right">Modified</div>
            </div>

            {/* Remote File List */}
            <div className="flex-1 overflow-y-auto font-sans text-xs text-on-surface divide-y divide-surface-container-low/30">
              {remoteFiles.map((file) => (
                <div
                  key={file.name}
                  className="grid grid-cols-12 px-3 py-1.5 hover:bg-surface-container-high cursor-pointer items-center transition-colors text-on-surface"
                >
                  <div className="col-span-5 flex items-center gap-2 truncate">
                    {getFileIcon(file.name, file.isDir)}
                    <span className="truncate">{file.name}</span>
                  </div>
                  <div className="col-span-2 text-right font-mono text-[11px] text-tertiary">
                    {file.isDir ? "DIR" : formatBytes(file.size)}
                  </div>
                  <div className="col-span-3 text-center font-mono text-[10px] text-secondary">
                    {file.perms}
                  </div>
                  <div className="col-span-2 text-right font-mono text-[11px] text-on-surface-variant">
                    {file.modified}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between px-3 py-1 bg-surface-container-low font-mono text-[11px] text-on-surface-variant border-t border-surface-container-highest">
              <span>{remoteFiles.length} remote items</span>
              <span>Encrypted WebRTC Channel</span>
            </div>
          </section>
        </div>

        {/* Bottom Transfer Queue Dock */}
        <footer className="h-32 bg-surface-dim flex flex-col px-4 py-2 shrink-0 border-t border-surface-container-highest justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-on-surface">Transfer Queue</span>
                <span className="px-1.5 py-0.5 rounded-full bg-secondary-container font-mono text-[9px] text-white font-bold">
                  {transfers.filter((t) => t.status === "transferring").length} ACTIVE
                </span>
                <span className="px-1.5 py-0.5 rounded-full bg-surface-container font-mono text-[9px] text-tertiary">
                  {transfers.filter((t) => t.status === "completed").length} COMPLETED
                </span>
              </div>
              <div className="h-3 w-px bg-surface-container-highest"></div>
              <div className="flex items-center gap-1.5 font-mono text-[11px] text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping"></span>
                <span>Throughput: 12.4 MB/s</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setTransfers([])}
                className="px-2.5 py-0.5 rounded bg-surface-container hover:bg-surface-bright text-on-surface-variant hover:text-on-surface font-mono text-[11px] transition cursor-pointer"
              >
                Clear Queue
              </button>
            </div>
          </div>

          {/* Active Transfer Progress Card */}
          {activeTransfer ? (
            <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container-highest/60 flex flex-col gap-1.5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <span className="material-symbols-outlined text-[16px] text-secondary">folder_zip</span>
                  <span className="text-xs font-semibold text-on-surface truncate">{activeTransfer.name}</span>
                  <span className="text-[10px] text-tertiary font-mono">Local → Remote</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[11px]">
                  <span className="text-secondary font-bold">{activeTransfer.progress || 37}%</span>
                  <span className="text-tertiary">12.4 MB/s</span>
                  <span className="text-on-surface-variant">ETA: 00:00:06</span>
                </div>
              </div>
              {/* Dual-gradient Progress Bar */}
              <div className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-secondary-container via-secondary to-teal-300 rounded-full transition-all duration-300"
                  style={{ width: `${activeTransfer.progress || 37}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="p-2 text-center text-xs text-tertiary bg-surface-container-lowest/50 rounded border border-surface-container-highest/30 font-mono">
              Ready for P2P transfers. Click "Upload" or select files above.
            </div>
          )}

          {/* Completed Sub-strip */}
          <div className="flex items-center gap-4 text-on-surface-variant font-mono text-[10px] truncate">
            <div className="flex items-center gap-1 shrink-0 text-secondary">
              <CheckCircle size={11} />
              <span>nginx.conf (4.1 KB) → synced in 0.08s</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-surface-container-highest"></div>
            <div className="flex items-center gap-1 shrink-0 text-secondary">
              <CheckCircle size={11} />
              <span>docker-compose.yml (2.8 KB) → synced in 0.04s</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
