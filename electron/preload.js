const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mexdeskAPI", {
  isElectron: true,
  platform: process.platform,

  // Screen Sources & Multi-Monitor enumeration
  getScreenSources: async () => {
    return await ipcRenderer.invoke("get-screen-sources");
  },
  getDisplays: async () => {
    return await ipcRenderer.invoke("get-displays");
  },
  setActiveDisplay: async (sourceId, bounds) => {
    return await ipcRenderer.invoke("set-active-display", { sourceId, bounds });
  },

  // Input simulation
  sendInput: (event) => {
    ipcRenderer.send("simulate-input", event);
  },

  // Remote session control authorization state
  updateSessionControlState: (active, controlGranted) => {
    ipcRenderer.send("session-control-state", { active, controlGranted });
  },

  // Clipboard integration
  readClipboard: async () => {
    return await ipcRenderer.invoke("clipboard-read");
  },
  writeClipboard: (text) => {
    ipcRenderer.send("clipboard-write", text);
  },

  // File save dialog & download
  saveFile: async (defaultName, buffer) => {
    return await ipcRenderer.invoke("save-file", { defaultName, buffer });
  },

  // Window control
  windowControl: (action) => {
    ipcRenderer.send("window-control", action);
  },

  // System info
  getSystemInfo: async () => {
    return await ipcRenderer.invoke("get-system-info");
  },

  // Unattended Access & Background Daemon
  getAutoStart: async () => {
    return await ipcRenderer.invoke("get-auto-start");
  },
  setAutoStart: async (enabled) => {
    return await ipcRenderer.invoke("set-auto-start", enabled);
  },
  getCloseToTray: async () => {
    return await ipcRenderer.invoke("get-close-to-tray");
  },
  setCloseToTray: async (enabled) => {
    return await ipcRenderer.invoke("set-close-to-tray", enabled);
  },
  lockWorkstation: async () => {
    return await ipcRenderer.invoke("system-lock-workstation");
  },
  installWindowsDaemon: async () => {
    return await ipcRenderer.invoke("install-windows-daemon");
  },

  // Listeners
  onRemoteInputEvent: (callback) => {
    ipcRenderer.on("remote-input-event", (_, data) => callback(data));
  }
});
