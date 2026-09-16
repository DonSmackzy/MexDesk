const { app, BrowserWindow, ipcMain, desktopCapturer, clipboard, dialog, screen, session } = require("electron");
const path = require("path");
const fs = require("fs").promises;
const os = require("os");
const inputController = require("./inputController");

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
    title: "MexDesk",
    icon: path.join(__dirname, "../public/logo.svg"),
    backgroundColor: "#F8FAFC",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      devTools: true,
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
    console.error(`[MexDesk Main] Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
  });

  // F12 or Ctrl+Shift+I toggles DevTools for diagnostics
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if ((input.key === "F12" && input.type === "keyDown") ||
        (input.control && input.shift && input.key.toLowerCase() === "i" && input.type === "keyDown")) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // Navigation Guard: Block arbitrary URL navigation (whitelist cloud + local)
  const ALLOWED_ORIGINS = ["https://mexdesk.onrender.com"];
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    try {
      const parsed = new URL(navigationUrl);
      const isLocal = parsed.protocol === "file:" || navigationUrl.startsWith("http://localhost:") || navigationUrl.startsWith("http://127.0.0.1:");
      const isAllowed = ALLOWED_ORIGINS.some((origin) => navigationUrl.startsWith(origin));
      if (!isLocal && !isAllowed) {
        console.warn(`[MexDesk Main] Blocked unauthorized navigation to: ${navigationUrl}`);
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });

  // Window Open Guard: Block unhandled external window pops
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.warn(`[MexDesk Main] Blocked window.open request for: ${url}`);
    return { action: "deny" };
  });

  // Load URL: Cloud primary in production, Vite dev server in development
  const CLOUD_URL = "https://mexdesk.onrender.com";
  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
  const localIndexPath = path.join(__dirname, "../dist/index.html");

  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    // DEV MODE: Vite dev server → fallback to local dist
    mainWindow.loadURL(devUrl).catch(() => {
      mainWindow.loadFile(localIndexPath).catch((err) => {
        console.warn("[MexDesk Main] Local dist load fallback:", err.message);
        setTimeout(() => mainWindow.loadURL(devUrl).catch(() => {}), 1500);
      });
    });
  } else {
    // PRODUCTION: Load live cloud app → fallback to local dist (offline mode)
    console.log(`[MexDesk Main] Loading cloud app: ${CLOUD_URL}`);
    mainWindow.loadURL(CLOUD_URL).catch((err) => {
      console.warn(`[MexDesk Main] Cloud URL failed (${err.message}), falling back to local dist/index.html`);
      mainWindow.loadFile(localIndexPath).catch((localErr) => {
        console.error("[MexDesk Main] Local fallback also failed:", localErr.message);
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
          const sources = await desktopCapturer.getSources({ types: ["screen"] });
          const primarySource = sources.find((s) => s.id.startsWith("screen")) || sources[0];
          if (primarySource) {
            console.log(`[MexDesk Main] Seamlessly capturing screen: ${primarySource.name} (${primarySource.id})`);
            callback({ video: primarySource });
          } else {
            callback({ video: request.video });
          }
        } catch (err) {
          console.error("[MexDesk Main] DisplayMedia handler error:", err);
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
    console.error("[MexDesk Main] Failed to fetch screen sources:", err.message);
    return [];
  }
});

ipcMain.on("simulate-input", async (event, inputPayload) => {
  // 1. Sender validation
  if (mainWindow && event.sender !== mainWindow.webContents) {
    console.warn("[MexDesk Main] Rejected input simulation from unauthorized webContents sender");
    return;
  }
  // 2. Schema and bounds validation
  if (!inputPayload || typeof inputPayload !== "object" || !inputPayload.type) return;

  if (inputPayload.type.startsWith("mouse") && (inputPayload.x !== undefined || inputPayload.y !== undefined)) {
    if (typeof inputPayload.x === "number" && (inputPayload.x < 0.0 || inputPayload.x > 1.0 || isNaN(inputPayload.x))) return;
    if (typeof inputPayload.y === "number" && (inputPayload.y < 0.0 || inputPayload.y > 1.0 || isNaN(inputPayload.y))) return;
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
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName || "mexdesk-download",
    });
    if (canceled || !filePath) return { success: false };

    await fs.writeFile(filePath, Buffer.from(buffer));
    return { success: true, filePath };
  } catch (err) {
    console.error("[MexDesk Main] Save file error:", err.message);
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
