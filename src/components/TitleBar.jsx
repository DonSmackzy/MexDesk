import React from 'react';
import { Settings, Minus, Square, X, Wifi, WifiOff, Plus, Monitor } from 'lucide-react';
import AegisLogo from './AegisLogo';

const TitleBar = ({
  onSettings,
  isOnline,
  // Multi-session tab props
  activeTab = 'home',
  sessions = {},
  onSwitchTab,
  onCloseTab,
}) => {
  const handleMinimize = () => {
    if (window.mexdeskAPI?.windowControl) window.mexdeskAPI.windowControl('minimize');
  };
  const handleMaximize = () => {
    if (window.mexdeskAPI?.windowControl) window.mexdeskAPI.windowControl('maximize');
  };
  const handleClose = () => {
    if (window.mexdeskAPI?.windowControl) window.mexdeskAPI.windowControl('close');
  };

  const formatId = (id) => {
    if (!id) return '???-???-???';
    const s = id.toString().replace(/-/g, '').padStart(9, '0');
    return `${s.slice(0, 3)}-${s.slice(3, 6)}-${s.slice(6, 9)}`;
  };

  const sessionEntries = Object.entries(sessions);

  return (
    <div
      className="bg-[#0F172A] border-b border-[#1E293B] flex items-center h-10 select-none text-slate-200"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* Left: Brand + Status */}
      <div className="flex items-center gap-2.5 px-3 shrink-0" style={{ WebkitAppRegion: 'no-drag' }}>
        <AegisLogo size={20} />
        <span className="text-sm font-semibold text-white tracking-tight">MexDesk</span>

        {/* Online/Offline Status Indicator matching mockup */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-1">
          <span
            className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-[#16A34A]' : 'bg-[#EF4444]'
            }`}
          />
          <span className="text-slate-400 font-medium">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Center: Session Tabs */}
      <div
        className="flex items-center gap-0.5 flex-1 min-w-0 h-full overflow-x-auto scrollbar-hide px-2"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        {/* Home / New Session Tab */}
        <button
          onClick={() => onSwitchTab?.('home')}
          className={`flex items-center gap-1.5 px-3 h-8 rounded-t-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
            activeTab === 'home'
              ? 'bg-[#1E293B] text-white shadow-sm border-t-2 border-t-[#818CF8] border-x border-x-[#334155]'
              : 'text-slate-400 hover:bg-[#1E293B]/60 hover:text-slate-200'
          }`}
        >
          <Plus size={12} />
          <span>New Session</span>
        </button>

        {/* Active Session Tabs */}
        {sessionEntries.map(([peerId, session]) => {
          const isActive = activeTab === peerId;
          const label = session.alias || formatId(peerId);
          const isConnected = session.connectionState === 'connected';

          return (
            <div
              key={peerId}
              className={`group flex items-center gap-1.5 px-3 h-8 rounded-t-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[#1E293B] text-white shadow-sm border-t-2 border-t-[#818CF8] border-x border-x-[#334155]'
                  : 'text-slate-400 hover:bg-[#1E293B]/60 hover:text-slate-200'
              }`}
              onClick={() => onSwitchTab?.(peerId)}
            >
              {/* Connection indicator */}
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isConnected ? 'bg-[#16A34A]' : session.isCalling ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
              {/* Session label */}
              <Monitor size={12} className="shrink-0 opacity-70" />
              <span className="max-w-[140px] truncate">{label}</span>
              {/* Unread indicator */}
              {session.unreadChatCount > 0 && (
                <span className="bg-[#4F46E5] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none min-w-[16px] text-center">
                  {session.unreadChatCount > 9 ? '9+' : session.unreadChatCount}
                </span>
              )}
              {/* Close button - red reserved for disconnect/close */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab?.(peerId);
                }}
                className="ml-0.5 p-0.5 rounded hover:bg-[#EF4444]/20 hover:text-[#EF4444] opacity-0 group-hover:opacity-100 transition-all"
                title="Close session"
              >
                <X size={11} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Right: Settings + Window Controls */}
      <div className="flex items-center gap-1 px-3 shrink-0" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={onSettings}
          className="p-1.5 hover:bg-[#1E293B] text-slate-400 hover:text-white rounded-md transition-colors"
          title="Settings"
        >
          <Settings size={14} />
        </button>

        <div className="w-px h-4 bg-[#334155] mx-1" />

        <button
          onClick={handleMinimize}
          className="p-1.5 hover:bg-[#1E293B] text-slate-400 hover:text-white rounded-md transition-colors"
          title="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={handleMaximize}
          className="p-1.5 hover:bg-[#1E293B] text-slate-400 hover:text-white rounded-md transition-colors"
          title="Maximize"
        >
          <Square size={12} />
        </button>
        <button
          onClick={handleClose}
          className="p-1.5 hover:bg-[#EF4444] hover:text-white text-slate-400 rounded-md transition-colors"
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export { TitleBar };
export default TitleBar;
