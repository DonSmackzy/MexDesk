const { app, BrowserWindow, ipcMain, desktopCapturer, clipboard, dialog, screen, session, Tray, Menu } = require("electron");
const path = require("path");
const fs = require("fs").promises;
const os = require("os");
const inputController = require("./inputController");

// Hardware GPU acceleration flags for low CPU usage & smooth video streaming
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");

let mainWindow = null;
let tray = null;
let isQuitting = false;
let closeToTray = true;
const CLOUD_URL = "https://mexdesk.onrender.com";
let currentCaptureSourceId = null;

function createTray() {
  if (tray) return;
  const iconPath = path.join(__dirname, "../public/icon.ico");
  try {
    tray = new Tray(iconPath);
  } catch (e) {
    try {
      tray = new Tray(path.join(__dirname, "../public/icon.png"));
    } catch (e2) {
      console.warn("[AegisDesk Tray] Failed to initialize tray icon:", e2.message);
      return;
    }
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open AegisDesk",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
      },
    },
    {
      label: "Lock Workstation",
      click: () => {
        inputController.lockWorkstation();
      },
    },
    { type: "separator" },
    {
      label: "Exit AegisDesk",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("AegisDesk - Enterprise Remote Desktop");
  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
  const localIndexPath = path.join(__dirname, "../dist/index.html");
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const isHiddenStartup = process.argv.includes("--hidden");

  mainWindow = new BrowserWindow({
    width: Math.min(1280, screenWidth - 100),
    height: Math.min(840, screenHeight - 80),
    minWidth: 980,
    minHeight: 640,
    show: !isHiddenStartup,
    frame: false, // Frameless window with AnyDesk styled custom title bar
    title: "AegisDesk",
    icon: path.join(__dirname, "../public/icon.ico"),
    backgroundColor: "#0F172A",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      devTools: !app.isPackaged,
    },
  });

  inputController.setScreenSize(screenWidth, screenHeight);

  // Forward renderer console messages to terminal for real-time debugging
  mainWindow.webContents.on("console-message", (event, level, message, line, sourceId) => {
    const src = sourceId ? path.basename(sourceId) : "renderer";
    console.log(`[Renderer ${level}] ${message} (${src}:${line})`);
  });

  // Log navigation load failures and fallback to local bundle
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[AegisDesk Main] Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
    if (validatedURL && validatedURL.startsWith(CLOUD_URL)) {
      console.warn("[AegisDesk Main] Cloud load failed, falling back to local bundle...");
      mainWindow.loadFile(localIndexPath).catch((err) => {
        console.error("[AegisDesk Main] Local load fallback also failed:", err.message);
      });
    }
  });

  // F12 or Ctrl+Shift+I toggles DevTools for diagnostics (dev mode only)
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (app.isPackaged) return; // Completely disabled in production builds
    if ((input.key === "F12" && input.type === "keyDown") ||
        (input.control && input.shift && input.key.toLowerCase() === "i" && input.type === "keyDown")) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // Navigation Guard: Block arbitrary URL navigation (whitelist exact cloud origin + local)
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    try {
      const parsed = new URL(navigationUrl);
      const isLocal = parsed.protocol === "file:" || parsed.origin === "http://localhost:5173" || parsed.origin === "http://127.0.0.1:5173";
      const isAllowedCloud = parsed.origin === "https://mexdesk.onrender.com";
      if (!isLocal && !isAllowedCloud) {
        console.warn(`[AegisDesk Main] Blocked unauthorized navigation to: ${navigationUrl}`);
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });

  // Frame Navigation Guard: Block child frame navigations
  mainWindow.webContents.on("will-frame-navigate", (event) => {
    if (event.frame && event.frame !== mainWindow.webContents.mainFrame) {
      console.warn(`[AegisDesk Main] Blocked child frame navigation to: ${event.url}`);
      event.preventDefault();
    }
  });

  // Window Open Guard: Block unhandled external window pops
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.warn(`[AegisDesk Main] Blocked window.open request for: ${url}`);
    return { action: "deny" };
  });

  // Load URL: Cloud primary in production, Vite dev server in development
  if (process.env.NODE_ENV === "development" && !app.isPackaged) {
    // DEV MODE: Vite dev server → fallback to local dist
    mainWindow.loadURL(devUrl).catch(() => {
      mainWindow.loadFile(localIndexPath).catch((err) => {
        console.warn("[AegisDesk Main] Local dist load fallback:", err.message);
        setTimeout(() => mainWindow.loadURL(devUrl).catch(() => {}), 1500);
      });
    });
  } else {
    // PRODUCTION: Load live app from cloud over the internet for automatic zero-touch updates.
    // If offline or cloud is unreachable, automatically fall back to the bundled local app.
    console.log(`[AegisDesk Main] Loading live app from cloud: ${CLOUD_URL}`);
    mainWindow.loadURL(CLOUD_URL).catch((err) => {
      console.warn(`[AegisDesk Main] Cloud load failed (${err.message}), falling back to local bundle`);
      mainWindow.loadFile(localIndexPath).catch((localErr) => {
        console.error("[AegisDesk Main] Local fallback also failed:", localErr.message);
      });
    });
  }

  mainWindow.on("close", (event) => {
    if (closeToTray && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Set default display media handler for automatic primary screen capture without picker prompts
    if (session?.defaultSession?.setDisplayMediaRequestHandler) {
      session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
        try {
          // Note: Frame identity check removed — it fails for cloud-loaded content
          // (https://mexdesk.onrender.com). Navigation guards already prevent
          // untrusted origins, so this is safe.
          console.log(`[AegisDesk Main] Display media request received (frame URL: ${request.frame?.url || "unknown"})`);

          const sources = await desktopCapturer.getSources({ types: ["screen"] });
          let selectedSource = null;
          if (currentCaptureSourceId) {
            selectedSource = sources.find((s) => s.id === currentCaptureSourceId);
          }
          if (!selectedSource) {
            selectedSource = sources.find((s) => s.id.startsWith("screen")) || sources[0];
          }

          const shouldCaptureAudio = process.platform === "win32";
          if (selectedSource) {
            console.log(`[AegisDesk Main] Seamlessly capturing screen & loopback audio: ${selectedSource.name} (${selectedSource.id})`);
            callback({
              video: selectedSource,
              audio: shouldCaptureAudio ? "loopback" : undefined,
            });
          } else {
            console.warn("[AegisDesk Main] No screen sources found, using request fallback");
            callback({
              video: request.video,
              audio: shouldCaptureAudio ? "loopback" : undefined,
            });
          }
        } catch (err) {
          console.error("[AegisDesk Main] DisplayMedia handler error:", err);
          callback({});
        }
      });
    }

    createTray();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Session Authorization State (Main Process Security Boundary)
let hostSessionActive = false;
let hostControlGranted = false;

ipcMain.on("session-control-state", (event, { active, controlGranted }) => {
  if (mainWindow && event.sender !== mainWindow.webContents) return;
  hostSessionActive = Boolean(active);
  hostControlGranted = Boolean(controlGranted);
  console.log(`[AegisDesk Main] Host session state updated: active=${hostSessionActive}, controlGranted=${hostControlGranted}`);
});

// IPC Handlers
ipcMain.handle("get-screen-sources", async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 400, height: 225 },
      fetchWindowIcons: true,
    });
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL(),
      display_id: s.display_id,
    }));
  } catch (err) {
    console.error("[AegisDesk Main] Failed to fetch screen sources:", err.message);
    return [];
  }
});

ipcMain.handle("get-displays", async () => {
  try {
    const displays = screen.getAllDisplays();
    const primary = screen.getPrimaryDisplay();
    const sources = await desktopCapturer.getSources({ types: ["screen"] });
    return displays.map((d, index) => {
      const matchingSource = sources.find((s) => s.display_id === String(d.id)) || sources[index];
      return {
        id: d.id,
        sourceId: matchingSource ? matchingSource.id : `screen:${index}:0`,
        name: matchingSource ? matchingSource.name : `Display ${index + 1}`,
        bounds: d.bounds,
        isPrimary: d.id === primary.id,
      };
    });
  } catch (err) {
    console.error("[AegisDesk Main] Failed to fetch displays:", err.message);
    return [];
  }
});

ipcMain.handle("set-active-display", async (event, { sourceId, bounds }) => {
  currentCaptureSourceId = sourceId || null;
  inputController.setActiveDisplayBounds(bounds || null);
  console.log(`[AegisDesk Main] Switched active display: sourceId=${sourceId}, bounds=`, bounds);
  return true;
});

const ALLOWED_INPUT_TYPES = [
  "mouse_move",
  "mouse_down",
  "mouse_up",
  "mouse_click",
  "mouse_dblclick",
  "mouse_wheel",
  "key_down",
  "key_up",
  "shortcut",
  "batch",
];

ipcMain.on("simulate-input", async (event, inputPayload) => {
  // 1. Sender validation
  if (mainWindow && event.sender !== mainWindow.webContents) {
    console.warn("[AegisDesk Main] Rejected input simulation from unauthorized webContents sender");
    return;
  }

  // 2. Authorization Gating: Remote input requires active host session AND control granted
  if (!hostSessionActive || !hostControlGranted) {
    console.warn(`[AegisDesk Main] Blocked input simulation: active=${hostSessionActive}, controlGranted=${hostControlGranted}`);
    return;
  }

  // 3. Schema and payload validation
  if (!inputPayload || typeof inputPayload !== "object" || !inputPayload.type) return;

  if (!ALLOWED_INPUT_TYPES.includes(inputPayload.type)) {
    console.warn(`[AegisDesk Main] Rejected unknown input event type: ${inputPayload.type}`);
    return;
  }

  // 4. Batch event execution
  if (inputPayload.type === "batch") {
    if (!Array.isArray(inputPayload.events)) return;
    const sanitizedEvents = [];
    for (const sub of inputPayload.events.slice(0, 60)) {
      if (!sub || typeof sub !== "object" || !sub.type || sub.type === "batch") continue;
      if (!ALLOWED_INPUT_TYPES.includes(sub.type)) continue;

      if (sub.type.startsWith("mouse") && (sub.x !== undefined || sub.y !== undefined)) {
        if (typeof sub.x === "number" && (sub.x < 0.0 || sub.x > 1.0 || isNaN(sub.x))) continue;
        if (typeof sub.y === "number" && (sub.y < 0.0 || sub.y > 1.0 || isNaN(sub.y))) continue;
      }

      if (sub.type === "key_down" || sub.type === "key_up") {
        const code = sub.code;
        const key = sub.key;
        if (code === "MetaLeft" || code === "MetaRight" || code === "OSLeft" || code === "OSRight" || key === "Meta" || key === "OS") continue;
      }

      sanitizedEvents.push(sub);
    }

    if (sanitizedEvents.length > 0) {
      await inputController.handleBatch({ events: sanitizedEvents });
    }
    return;
  }

  // 5. Coordinate bounds validation (normalized [0.0, 1.0])
  if (inputPayload.type.startsWith("mouse") && (inputPayload.x !== undefined || inputPayload.y !== undefined)) {
    if (typeof inputPayload.x === "number" && (inputPayload.x < 0.0 || inputPayload.x > 1.0 || isNaN(inputPayload.x))) return;
    if (typeof inputPayload.y === "number" && (inputPayload.y < 0.0 || inputPayload.y > 1.0 || isNaN(inputPayload.y))) return;
  }

  // 6. Block dangerous OS meta keys (Windows Key / Win+R prevention)
  if (inputPayload.type === "key_down" || inputPayload.type === "key_up") {
    const code = inputPayload.code;
    const key = inputPayload.key;
    if (code === "MetaLeft" || code === "MetaRight" || code === "OSLeft" || code === "OSRight" || key === "Meta" || key === "OS") {
      console.warn(`[AegisDesk Main] Blocked dangerous key injection attempt: ${code || key}`);
      return;
    }
  }

  await inputController.handleEvent(inputPayload);
});

ipcMain.handle("clipboard-read", () => {
  return clipboard.readText();
});

ipcMain.on("clipboard-write", (_, text) => {
  if (text) clipboard.writeText(text);
});

ipcMain.handle("save-file", async (_, { defaultName, buffer }) => {
  try {
    // Sanitize filename to prevent directory traversal and illegal characters
    const rawName = typeof defaultName === "string" ? path.basename(defaultName) : "aegisdesk-download";
    const sanitizedName = rawName.replace(/[/\\?%*:|"<>]/g, "_").replace(/^\.+/, "").trim() || "aegisdesk-download";

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: sanitizedName,
    });
    if (canceled || !filePath) return { success: false };

    await fs.writeFile(filePath, Buffer.from(buffer));
    return { success: true, filePath };
  } catch (err) {
    console.error("[AegisDesk Main] Save file error:", err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.on("window-control", (_, action) => {
  if (!mainWindow) return;
  switch (action) {
    case "minimize":
      mainWindow.minimize();
      break;
    case "maximize":
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      break;
    case "close":
      mainWindow.close();
      break;
    default:
      break;
  }
});

ipcMain.handle("get-system-info", () => {
  return {
    hostname: os.hostname(),
    platform: process.platform,
    arch: os.arch(),
    release: os.release(),
    username: os.userInfo().username,
  };
});

// Auto-Start at Boot IPC Handlers (Unattended Access Daemon)
ipcMain.handle("get-auto-start", () => {
  try {
    const settings = app.getLoginItemSettings();
    return settings.openAtLogin;
  } catch (err) {
    console.error("[AegisDesk Main] get-auto-start error:", err.message);
    return false;
  }
});

ipcMain.handle("set-auto-start", (_, enabled) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: Boolean(enabled),
      openAsHidden: true,
      path: process.execPath,
      args: ["--hidden"],
    });
    console.log(`[AegisDesk Main] Auto-start set to: ${enabled}`);
    return true;
  } catch (err) {
    console.error("[AegisDesk Main] set-auto-start error:", err.message);
    return false;
  }
});

ipcMain.handle("get-close-to-tray", () => {
  return closeToTray;
});

ipcMain.handle("set-close-to-tray", (_, enabled) => {
  closeToTray = Boolean(enabled);
  console.log(`[AegisDesk Main] Close-to-tray set to: ${closeToTray}`);
  return closeToTray;
});

ipcMain.handle("system-lock-workstation", () => {
  return inputController.lockWorkstation();
});

ipcMain.handle("install-windows-daemon", async () => {
  if (process.platform !== "win32") return { success: false, message: "Only supported on Windows" };
  const { exec } = require("child_process");
  const execPath = process.execPath;
  const cmd = `schtasks /Create /TN "AegisDesk" /TR "\\"${execPath}\\" --hidden" /SC ONLOGON /RL HIGHEST /F`;
  return new Promise((resolve) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.warn("[AegisDesk Main] schtasks registration error:", err.message);
        resolve({ success: false, error: stderr || err.message });
      } else {
        console.log("[AegisDesk Main] schtasks registered successfully:", stdout);
        resolve({ success: true, message: "Elevated background task registered." });
      }
    });
  });
});
