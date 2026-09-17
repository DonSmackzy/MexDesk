const { app, BrowserWindow, ipcMain, desktopCapturer, clipboard, dialog, screen, session } = require("electron");
const path = require("path");
const fs = require("fs").promises;
const os = require("os");
const inputController = require("./inputController");

// Hardware GPU acceleration flags for low CPU usage & smooth video streaming
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");

let mainWindow = null;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1280, screenWidth - 100),
    height: Math.min(840, screenHeight - 80),
    minWidth: 980,
    minHeight: 640,
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

  // Log navigation load failures
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[AegisDesk Main] Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
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
  const CLOUD_URL = "https://mexdesk.onrender.com";
  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
  const localIndexPath = path.join(__dirname, "../dist/index.html");

  if (process.env.NODE_ENV === "development" && !app.isPackaged) {
    // DEV MODE: Vite dev server → fallback to local dist
    mainWindow.loadURL(devUrl).catch(() => {
      mainWindow.loadFile(localIndexPath).catch((err) => {
        console.warn("[AegisDesk Main] Local dist load fallback:", err.message);
        setTimeout(() => mainWindow.loadURL(devUrl).catch(() => {}), 1500);
      });
    });
  } else {
    // PRODUCTION: Load live cloud app for instant web updates, fallback to local dist if offline
    console.log(`[AegisDesk Main] Loading live cloud app: ${CLOUD_URL}`);
    mainWindow.loadURL(CLOUD_URL).catch((err) => {
      console.warn(`[AegisDesk Main] Cloud URL load failed (${err.message}), falling back to local bundled dist`);
      mainWindow.loadFile(localIndexPath).catch((localErr) => {
        console.error("[AegisDesk Main] Local fallback also failed:", localErr.message);
      });
    });
  }

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
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // Set default display media handler for automatic primary screen capture without picker prompts
    if (session?.defaultSession?.setDisplayMediaRequestHandler) {
      session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
        try {
          // Security check: ensure capture request originates from top-level trusted mainFrame
          if (mainWindow && request.frame !== mainWindow.webContents.mainFrame) {
            console.warn("[AegisDesk Main] Blocked display media request from non-main frame");
            return callback({});
          }

          const sources = await desktopCapturer.getSources({ types: ["screen"] });
          const primarySource = sources.find((s) => s.id.startsWith("screen")) || sources[0];
          if (primarySource) {
            console.log(`[AegisDesk Main] Seamlessly capturing screen: ${primarySource.name} (${primarySource.id})`);
            callback({ video: primarySource });
          } else {
            callback({ video: request.video });
          }
        } catch (err) {
          console.error("[AegisDesk Main] DisplayMedia handler error:", err);
          callback({});
        }
      });
    }

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

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
];

ipcMain.on("simulate-input", async (event, inputPayload) => {
  // 1. Sender and frame validation
  if (mainWindow && event.sender !== mainWindow.webContents) {
    console.warn("[AegisDesk Main] Rejected input simulation from unauthorized webContents sender");
    return;
  }
  if (mainWindow && event.senderFrame && event.senderFrame !== mainWindow.webContents.mainFrame) {
    console.warn("[AegisDesk Main] Rejected input simulation from non-main frame");
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

  // 4. Coordinate bounds validation (normalized [0.0, 1.0])
  if (inputPayload.type.startsWith("mouse") && (inputPayload.x !== undefined || inputPayload.y !== undefined)) {
    if (typeof inputPayload.x === "number" && (inputPayload.x < 0.0 || inputPayload.x > 1.0 || isNaN(inputPayload.x))) return;
    if (typeof inputPayload.y === "number" && (inputPayload.y < 0.0 || inputPayload.y > 1.0 || isNaN(inputPayload.y))) return;
  }

  // 5. Block dangerous OS meta keys (Windows Key / Win+R prevention)
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
