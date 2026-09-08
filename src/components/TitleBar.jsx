import React from "react";
import { Minus, Square, X, Wifi, WifiOff, ShieldCheck, Settings as SettingsIcon } from "lucide-react";

export function TitleBar({ isConnected, myId, onOpenSettings }) {
  const isElectron = !!window.mexdeskAPI?.isElectron;

  const handleWindow = (action) => {
    if (isElectron) {
      window.mexdeskAPI.windowControl(action);
    }
  };

  return (
    <header className="h-10 bg-white border-b border-slate-200 flex items-center justify-between px-3 electron-drag-region select-none z-50">
      {/* Brand & Connection State */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-md bg-mexdesk-red flex items-center justify-center text-white font-bold text-xs shadow-sm">
            M
          </div>
          <span className="font-semibold text-slate-800 text-sm tracking-tight">
            Mex<span className="text-mexdesk-red">Desk</span>
          </span>
        </div>

        <div className="h-4 w-px bg-slate-200 mx-1"></div>

        {/* Network status pill */}
        <div className="flex items-center space-x-1.5 text-xs">
          {isConnected ? (
            <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium text-[11px] border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Ready</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium text-[11px] border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span>Connecting to Relay...</span>
            </span>
          )}

          {myId && (
            <span className="text-slate-400 text-[11px] font-mono">
              ID: {myId}
            </span>
          )}
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center space-x-1 electron-no-drag">
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition"
          title="Settings"
        >
          <SettingsIcon size={15} />
        </button>

        {isElectron && (
          <div className="flex items-center ml-2 space-x-0.5">
            <button
              onClick={() => handleWindow("minimize")}
              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition rounded"
              title="Minimize"
            >
              <Minus size={14} />
            </button>
            <button
              onClick={() => handleWindow("maximize")}
              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition rounded"
              title="Maximize"
            >
              <Square size={12} />
            </button>
            <button
              onClick={() => handleWindow("close")}
              className="p-1.5 hover:bg-mexdesk-red hover:text-white text-slate-500 transition rounded"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
