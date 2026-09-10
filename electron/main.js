const { app, BrowserWindow, ipcMain, desktopCapturer, clipboard, dialog, screen } = require("electron");
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
    },
  });

  inputController.setScreenSize(screenWidth, screenHeight);

  // Load Vite dev server URL or local index.html in production
  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    mainWindow.loadURL(devUrl).catch(() => {
      // Retry or load built dist if dev server not running
      const indexPath = path.join(__dirname, "../dist/index.html");
      mainWindow.loadFile(indexPath).catch(() => {
        setTimeout(() => mainWindow.loadURL(devUrl), 1500);
      });
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
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
      session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
        desktopCapturer
          .getSources({ types: ["screen"] })
          .then((sources) => {
            const primarySource = sources.find((s) => s.id.startsWith("screen")) || sources[0];
            if (primarySource) {
              callback({ video: primarySource });
            } else {
              callback({ video: request.video });
            }
          })
          .catch((err) => {
            console.error("[MexDesk Main] DisplayMedia handler error:", err);
            callback({});
          });
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

ipcMain.on("simulate-input", async (_, event) => {
  await inputController.handleEvent(event);
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
