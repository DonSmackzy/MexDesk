# MexDesk 🔴⚪

**MexDesk** is a high-performance, AnyDesk-competing remote desktop application featuring an iconic red-and-white theme, sub-30ms WebRTC low-latency streaming, and an enterprise feature suite.

---

## 🌟 Key Features

- **Iconic AnyDesk Red & White UI**: Clean, modern interface styled after AnyDesk with high-contrast buttons, status badges, and 9-digit address display (`XXX-XXX-XXX`).
- **Remote Desktop Control**: High-FPS screen sharing with mouse clicks, drag & drop, wheel scrolling, and keyboard keystrokes.
- **Dual-Pane File Transfer**: AnyDesk-style dual-pane explorer (Local Computer ↔ Remote Computer) with 64KB chunked WebRTC DataChannel streaming and transfer progress.
- **In-Session Chat**: Real-time slide-over encrypted text messaging with audio chimes and quick canned replies.
- **Interactive Whiteboard**: On-screen drawing canvas overlay with AnyDesk Red pen, highlighters, arrows, shapes, and eraser synced across peers in real time.
- **Session Recording**: Native video capture recording the remote session directly into `.webm` format with zero CPU overhead.
- **Unattended Access**: Password-protected unattended access allowing instant connection without remote physical approval.
- **Privacy Mode**: Black out remote screen for confidentiality during sensitive maintenance tasks.
- **Performance HUD**: Real-time FPS counter, bitrate throughput (kbps), and round-trip ping latency.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
# In MexDesk root
npm install

# In server directory
cd server
npm install
cd ..
```

### 2. Start the Signaling Server
```bash
npm run server
```
*Runs on `ws://localhost:7777` by default.*

### 3. Launch MexDesk

#### Option A: Web / Browser Mode (Fast testing & zero-install client)
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser. Open two browser tabs or windows to test remote connection between two 9-digit MexDesk IDs!

#### Option B: Native Desktop Electron App
```bash
npm run electron:dev
```
Launches the signaling server, Vite development server, and native Electron desktop window simultaneously.

---

## 🏗️ Architecture

```
MexDesk/
├── server/                          # Standalone WebSocket Signaling & Relay Server
│   ├── package.json
│   └── src/index.js                 # 9-digit ID generation, peer routing, SDP/ICE relay
├── electron/                        # Electron Main Process & Input Injection
│   ├── main.js                      # Frameless window, IPC handlers, system tray
│   ├── preload.js                   # Secure contextBridge API
│   └── inputController.js           # Mouse & keyboard event simulation
├── src/                             # React 18 + Tailwind Renderer
│   ├── components/
│   │   ├── TitleBar.jsx             # Frameless title bar with status & controls
│   │   ├── HomeScreen.jsx           # AnyDesk "This Desk" & "Remote Desk" dashboard
│   │   ├── RemoteViewer.jsx         # Fullscreen video canvas with floating toolbar
│   │   ├── WhiteboardOverlay.jsx    # Real-time collaborative drawing canvas
│   │   ├── FileTransferModal.jsx    # Dual-pane file manager & chunked uploader
│   │   ├── ChatDrawer.jsx           # Slide-over in-session messaging
│   │   ├── IncomingCallModal.jsx    # AnyDesk incoming connection authorization
│   │   └── SettingsModal.jsx        # Unattended password, display, and network
│   ├── services/
│   │   ├── SignalingClient.js       # WebSocket client for peer discovery
│   │   ├── WebRTCConnection.js      # RTCPeerConnection & DataChannels manager
│   │   ├── FileTransferEngine.js    # Binary chunking with backpressure handling
│   │   └── InputCapture.js          # Mouse/keyboard event normalizer
│   ├── App.jsx                      # Main app controller
│   ├── main.jsx                     # React entry point
│   └── index.css                    # Tailwind & AnyDesk theme definitions
├── package.json
├── vite.config.js
└── tailwind.config.js
```
