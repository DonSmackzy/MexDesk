const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mexdeskAPI", {
  isElectron: true,
  platform: process.platform,

  // Screen Sources enumeration
  getScreenSources: async () => {
    return await ipcRenderer.invoke("get-screen-sources");
  },

  // Input simulation
  sendInput: (event) => {
    ipcRenderer.send("simulate-input", event);
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

  // Listeners
  onRemoteInputEvent: (callback) => {
    ipcRenderer.on("remote-input-event", (_, data) => callback(data));
  }
});
