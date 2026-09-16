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
      className="bg-white border-b border-aegis-border flex items-center h-10 select-none"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* Left: Brand + Status */}
      <div className="flex items-center gap-2 px-3 shrink-0" style={{ WebkitAppRegion: 'no-drag' }}>
        <AegisLogo size={22} />
        <span className="text-sm font-semibold text-aegis-darker hidden sm:inline">AegisDesk</span>

        {/* Online/Offline Status Pill */}
        <div
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            isOnline ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {isOnline ? (
            <>
              <Wifi size={10} />
              <span>Online</span>
            </>
          ) : (
            <>
              <WifiOff size={10} />
              <span>Offline</span>
            </>
          )}
        </div>
      </div>

      {/* Center: Session Tabs */}
      <div
        className="flex items-center gap-0.5 flex-1 min-w-0 h-full overflow-x-auto scrollbar-hide px-1"
        style={{ WebkitAppRegion: 'no-drag' }}
      >
        {/* Home / New Session Tab */}
        <button
          onClick={() => onSwitchTab?.('home')}
          className={`flex items-center gap-1.5 px-3 h-8 rounded-t-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
            activeTab === 'home'
              ? 'bg-white text-aegis-darker shadow-sm border-t-2 border-t-[#DC2626] border-x border-x-aegis-border'
              : 'text-gray-500 hover:bg-aegis-lightgray hover:text-aegis-darker'
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
                  ? 'bg-white text-aegis-darker shadow-sm border-t-2 border-t-[#DC2626] border-x border-x-aegis-border'
                  : 'text-gray-500 hover:bg-aegis-lightgray hover:text-aegis-darker'
              }`}
              onClick={() => onSwitchTab?.(peerId)}
            >
              {/* Connection indicator */}
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isConnected ? 'bg-green-500' : session.isCalling ? 'bg-yellow-500 animate-pulse' : 'bg-gray-400'
                }`}
              />
              {/* Session label */}
              <Monitor size={12} className="shrink-0 opacity-60" />
              <span className="max-w-[140px] truncate">{label}</span>
              {/* Unread indicator */}
              {session.unreadChatCount > 0 && (
                <span className="bg-[#DC2626] text-white text-[9px] font-bold px-1 py-0.5 rounded-full leading-none min-w-[16px] text-center">
                  {session.unreadChatCount > 9 ? '9+' : session.unreadChatCount}
                </span>
              )}
              {/* Close button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab?.(peerId);
                }}
                className="ml-0.5 p-0.5 rounded hover:bg-[#FEE2E2] hover:text-[#DC2626] opacity-0 group-hover:opacity-100 transition-all"
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
          className="p-1.5 hover:bg-aegis-lightgray rounded-md transition-colors"
          title="Settings"
        >
          <Settings size={14} className="text-aegis-darker" />
        </button>

        <div className="w-px h-4 bg-aegis-border mx-1" />

        <button
          onClick={handleMinimize}
          className="p-1.5 hover:bg-aegis-lightgray rounded-md transition-colors"
          title="Minimize"
        >
          <Minus size={14} className="text-aegis-darker" />
        </button>
        <button
          onClick={handleMaximize}
          className="p-1.5 hover:bg-aegis-lightgray rounded-md transition-colors"
          title="Maximize"
        >
          <Square size={12} className="text-aegis-darker" />
        </button>
        <button
          onClick={handleClose}
          className="p-1.5 hover:bg-red-100 hover:text-red-600 rounded-md transition-colors"
          title="Close"
        >
          <X size={14} className="text-aegis-darker" />
        </button>
      </div>
    </div>
  );
};

export { TitleBar };
export default TitleBar;
