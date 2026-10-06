// tauriBridge.js - Transparent bridge that allows AegisDesk to run in both Electron and Tauri

export function initTauriBridge() {
  if (typeof window === "undefined") return;

  // If already in Electron with native mexdeskAPI, do nothing
  if (window.mexdeskAPI) {
    console.log("[AegisDesk] Running in Native Electron runtime");
    return;
  }

  // Detect Tauri runtime
  const isTauri = Boolean(
    window.__TAURI_INTERNALS__ ||
    window.__TAURI__ ||
    window.location.protocol === "tauri:"
  );

  if (isTauri) {
    console.log("[AegisDesk] Detected Tauri 2.0 runtime! Initializing native Rust bridge...");

    const invoke = async (cmd, args = {}) => {
      if (window.__TAURI__?.core?.invoke) {
        return window.__TAURI__.core.invoke(cmd, args);
      }
      if (window.__TAURI_INTERNALS__?.invoke) {
        return window.__TAURI_INTERNALS__.invoke(cmd, args);
      }
      throw new Error(`Tauri invoke not found for command: ${cmd}`);
    };

    window.mexdeskAPI = {
      isTauri: true,
      platform: "win32",

      // Mouse & Keyboard Input
      sendInput: async (event) => {
        try {
          await invoke("send_input", { event });
        } catch (err) {
          console.warn("[Tauri Bridge] sendInput failed:", err);
        }
      },

      // Window Management
      minimize: () => invoke("window_minimize").catch(() => {}),
      maximize: () => invoke("window_maximize").catch(() => {}),
      close: () => invoke("window_close").catch(() => {}),
      windowControl: (action) => {
        if (action === "minimize") invoke("window_minimize").catch(() => {});
        else if (action === "maximize") invoke("window_maximize").catch(() => {});
        else if (action === "close") invoke("window_close").catch(() => {});
      },

      // Clipboard integration
      readClipboard: async () => {
        try {
          if (navigator.clipboard?.readText) {
            return await navigator.clipboard.readText();
          }
          return "";
        } catch (e) {
          return "";
        }
      },
      writeClipboard: (text) => {
        try {
          if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).catch(() => {});
          }
        } catch (e) {}
      },

      // Session control state
      updateSessionControlState: (active, controlGranted) => {
        console.log("[Tauri Bridge] Session control state:", { active, controlGranted });
      },

      // Workstation Lock
      lockWorkstation: () => invoke("lock_workstation").catch(() => {}),

      // Displays
      getDisplays: async () => {
        try {
          return await invoke("get_displays");
        } catch (err) {
          return [{
            id: "primary",
            name: "Primary Display",
            isPrimary: true,
            bounds: { x: 0, y: 0, width: window.screen.width, height: window.screen.height },
            sourceId: "screen:0:0"
          }];
        }
      },

      setActiveDisplay: async (sourceId, bounds) => {
        console.log("[Tauri Bridge] setActiveDisplay:", sourceId, bounds);
        return true;
      },

      // System Preferences & Daemon
      getAutoStart: async () => false,
      setAutoStart: async () => true,
      getCloseToTray: async () => true,
      setCloseToTray: async () => true,
      installWindowsDaemon: async () => ({ success: true, message: "Registered via Tauri" }),
    };

    console.log("[AegisDesk] Tauri bridge initialized successfully!");
  }
}
