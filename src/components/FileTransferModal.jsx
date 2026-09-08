import React, { useState, useEffect, useRef } from "react";
import {
  FolderSync,
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
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { FileTransferEngine } from "../services/FileTransferEngine";

export function FileTransferModal({ webrtc, targetPeerId, onClose }) {
  const fileInputRef = useRef(null);
  const [engine, setEngine] = useState(null);

  // Active transfers
  const [transfers, setTransfers] = useState([]);
  const [selectedLocalFiles, setSelectedLocalFiles] = useState([]);
  const [localPath, setLocalPath] = useState("C:\\Users\\User\\Documents");
  const [remotePath, setRemotePath] = useState("C:\\Users\\RemoteDesk\\Downloads");

  // Simulated local directory items
  const [localFiles, setLocalFiles] = useState([
    { name: "Project_Proposal.pdf", size: 2450000, type: "doc", modified: "2026-09-01" },
    { name: "Design_Assets.zip", size: 18400000, type: "archive", modified: "2026-09-05" },
    { name: "Screenshot_01.png", size: 1200000, type: "image", modified: "2026-09-08" },
    { name: "Setup_Script.ps1", size: 8400, type: "code", modified: "2026-09-08" },
  ]);

  // Simulated remote directory items + received files
  const [remoteFiles, setRemoteFiles] = useState([
    { name: "Logs_2026_09.txt", size: 45000, type: "doc", modified: "2026-09-08" },
    { name: "Client_Database_Dump.sql", size: 32000000, type: "code", modified: "2026-09-07" },
  ]);

  useEffect(() => {
    if (!webrtc) return;
    const ftEngine = new FileTransferEngine(webrtc);
    setEngine(ftEngine);

    ftEngine.on("transfer-started", (data) => {
      setTransfers((prev) => [
        ...prev.filter((t) => t.id !== data.id),
        { ...data, progress: 0, status: "transferring" },
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

      // If we downloaded a file, trigger download or add to remoteFiles
      if (data.blob) {
        const url = URL.createObjectURL(data.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.name;
        a.click();
        URL.revokeObjectURL(url);

        setRemoteFiles((prev) => [
          { name: data.name, size: data.blob.size, type: "doc", modified: "Just now" },
          ...prev,
        ]);
      }
    });

    return () => {
      // cleanup
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
      // Add to local files view
      setLocalFiles((prev) => [
        { name: file.name, size: file.size, type: "file", modified: "Just now" },
        ...prev,
      ]);
      await engine.sendFile(file);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getFileIcon = (name) => {
    if (name.match(/\.(png|jpg|jpeg|svg|webp)$/i)) return <Image size={15} className="text-emerald-500" />;
    if (name.match(/\.(mp4|mkv|webm)$/i)) return <Film size={15} className="text-purple-500" />;
    if (name.match(/\.(mp3|wav)$/i)) return <Music size={15} className="text-amber-500" />;
    if (name.match(/\.(pdf|docx?|txt)$/i)) return <FileText size={15} className="text-blue-500" />;
    return <File size={15} className="text-slate-400" />;
  };

  return (
    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl h-[580px] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-mexdesk-lightred flex items-center justify-center text-mexdesk-red">
              <FolderSync size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">MexDesk File Transfer</h2>
              <p className="text-[11px] text-slate-400">
                P2P direct transfer with desk <strong className="font-mono text-slate-600">{targetPeerId}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleNativeFilesSelected}
            />
            <button
              onClick={handleUploadClick}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-mexdesk-red hover:bg-mexdesk-crimson text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              <Upload size={14} />
              <span>Send File...</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Dual-Pane Explorer */}
        <div className="flex-1 grid grid-cols-2 divide-x divide-slate-200 overflow-hidden">
          {/* LEFT PANE: LOCAL DESK */}
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center space-x-1">
                <Folder size={14} className="text-amber-500" />
                <span>This Computer</span>
              </span>
              <span className="text-[11px] font-mono text-slate-400 truncate max-w-[180px]">{localPath}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {localFiles.map((file) => {
                const isSelected = selectedLocalFiles.includes(file.name);
                return (
                  <div
                    key={file.name}
                    onClick={() => handleSelectLocalFile(file.name)}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition select-none ${
                      isSelected
                        ? "bg-rose-50 text-mexdesk-red font-medium border border-rose-200"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      {getFileIcon(file.name)}
                      <span className="truncate">{file.name}</span>
                    </div>
                    <div className="flex items-center space-x-3 text-[11px] text-slate-400 font-mono shrink-0">
                      <span>{formatBytes(file.size)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT PANE: REMOTE DESK */}
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center space-x-1">
                <Folder size={14} className="text-mexdesk-red" />
                <span>Remote Computer</span>
              </span>
              <span className="text-[11px] font-mono text-slate-400 truncate max-w-[180px]">{remotePath}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {remoteFiles.map((file) => (
                <div
                  key={file.name}
                  className="flex items-center justify-between p-2 rounded-lg text-xs hover:bg-slate-50 text-slate-700 select-none"
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    {getFileIcon(file.name)}
                    <span className="truncate">{file.name}</span>
                  </div>
                  <div className="flex items-center space-x-3 text-[11px] text-slate-400 font-mono shrink-0">
                    <span>{formatBytes(file.size)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Transfer Progress Bar & Queue */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 min-h-[70px] flex flex-col justify-center">
          {transfers.length === 0 ? (
            <p className="text-center text-xs text-slate-400">
              Select files or click "Send File" to transfer over WebRTC DataChannel.
            </p>
          ) : (
            <div className="space-y-2">
              {transfers.slice(-2).map((t) => (
                <div key={t.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 truncate max-w-xs flex items-center space-x-1.5">
                      {t.status === "completed" ? (
                        <CheckCircle2 size={13} className="text-emerald-500" />
                      ) : (
                        <ArrowRight size={13} className="text-mexdesk-red animate-pulse" />
                      )}
                      <span>{t.name}</span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">{t.progress || 0}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-mexdesk-red h-full transition-all duration-200 rounded-full"
                      style={{ width: `${t.progress || 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
