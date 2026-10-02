// InputCapture.js - Normalizes and transmits user input to remote desk

export class InputCapture {
  constructor(webrtc, targetElement, videoElement = null) {
    this.webrtc = webrtc;
    this.targetElement = targetElement;
    this.videoElement = videoElement;
    this.isEnabled = false;
    // 60Hz Micro-batching state
    this.batchQueue = [];
    this.latestMouseMove = null;
    this.rafId = null;

    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundWheel = this.onWheel.bind(this);
    this.boundContextMenu = this.onContextMenu.bind(this);
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
  }

  setVideoElement(videoEl) {
    this.videoElement = videoEl;
  }

  attach(element, videoElement = null) {
    this.targetElement = element;
    if (videoElement) this.videoElement = videoElement;
    if (!this.targetElement) return;

    this.targetElement.addEventListener("mousemove", this.boundMouseMove);
    this.targetElement.addEventListener("mousedown", this.boundMouseDown);
    this.targetElement.addEventListener("mouseup", this.boundMouseUp);
    this.targetElement.addEventListener("wheel", this.boundWheel, { passive: false });
    this.targetElement.addEventListener("contextmenu", this.boundContextMenu);

    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("keyup", this.boundKeyUp);

    this.isEnabled = true;
  }

  detach() {
    this.isEnabled = false;
    if (this.targetElement) {
      this.targetElement.removeEventListener("mousemove", this.boundMouseMove);
      this.targetElement.removeEventListener("mousedown", this.boundMouseDown);
      this.targetElement.removeEventListener("mouseup", this.boundMouseUp);
      this.targetElement.removeEventListener("wheel", this.boundWheel);
      this.targetElement.removeEventListener("contextmenu", this.boundContextMenu);
    }
    window.removeEventListener("keydown", this.boundKeyDown);
    window.removeEventListener("keyup", this.boundKeyUp);
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.latestMouseMove = null;
    this.batchQueue = [];
  }

  getNormalizedCoords(event) {
    if (!this.targetElement) return { x: 0, y: 0 };

    const containerRect = this.targetElement.getBoundingClientRect();
    if (containerRect.width <= 0 || containerRect.height <= 0) return { x: 0, y: 0 };

    // If video element is available with known video dimensions, adjust for letterbox / pillarbox
    if (this.videoElement && this.videoElement.videoWidth > 0 && this.videoElement.videoHeight > 0) {
      const videoW = this.videoElement.videoWidth;
      const videoH = this.videoElement.videoHeight;
      const containerW = containerRect.width;
      const containerH = containerRect.height;

      const videoAspect = videoW / videoH;
      const containerAspect = containerW / containerH;

      let renderW = containerW;
      let renderH = containerH;
      let offsetX = 0;
      let offsetY = 0;

      if (containerAspect > videoAspect) {
        // Black bars on left/right (pillarbox)
        renderH = containerH;
        renderW = renderH * videoAspect;
        offsetX = (containerW - renderW) / 2;
      } else {
        // Black bars on top/bottom (letterbox)
        renderW = containerW;
        renderH = renderW / videoAspect;
        offsetY = (containerH - renderH) / 2;
      }

      const clickX = event.clientX - containerRect.left - offsetX;
      const clickY = event.clientY - containerRect.top - offsetY;

      const normX = Math.max(0.0, Math.min(1.0, clickX / renderW));
      const normY = Math.max(0.0, Math.min(1.0, clickY / renderH));
      return { x: normX, y: normY };
    }

    const x = Math.max(0.0, Math.min(1.0, (event.clientX - containerRect.left) / containerRect.width));
    const y = Math.max(0.0, Math.min(1.0, (event.clientY - containerRect.top) / containerRect.height));
    return { x, y };
  }

  scheduleFlush() {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.flushBatch();
    });
  }

  flushBatch() {
    if (this.latestMouseMove) {
      this.batchQueue.push({
        type: "mouse_move",
        x: this.latestMouseMove.x,
        y: this.latestMouseMove.y,
      });
      this.latestMouseMove = null;
    }

    if (this.batchQueue.length === 0) return;

    if (this.batchQueue.length === 1) {
      this.sendDirect(this.batchQueue[0]);
    } else {
      this.sendDirect({
        type: "batch",
        events: this.batchQueue,
      });
    }
    this.batchQueue = [];
  }

  onMouseMove(e) {
    if (!this.isEnabled) return;
    const coords = this.getNormalizedCoords(e);
    // Coalesce high-frequency mousemove events into a single 60Hz sample
    this.latestMouseMove = coords;
    this.scheduleFlush();
  }

  onMouseDown(e) {
    if (!this.isEnabled) return;
    const coords = this.getNormalizedCoords(e);
    this.latestMouseMove = coords;
    this.batchQueue.push({
      type: "mouse_down",
      button: e.button,
      x: coords.x,
      y: coords.y,
    });
    // Immediately flush on click for zero latency
    this.flushBatch();
  }

  onMouseUp(e) {
    if (!this.isEnabled) return;
    const coords = this.getNormalizedCoords(e);
    this.latestMouseMove = coords;
    this.batchQueue.push({
      type: "mouse_up",
      button: e.button,
      x: coords.x,
      y: coords.y,
    });
    this.flushBatch();
  }

  onWheel(e) {
    if (!this.isEnabled) return;
    e.preventDefault();
    this.batchQueue.push({
      type: "mouse_wheel",
      deltaX: e.deltaX,
      deltaY: e.deltaY,
    });
    this.scheduleFlush();
  }

  onContextMenu(e) {
    if (!this.isEnabled) return;
    e.preventDefault(); // Suppress local context menu so remote gets the right-click
  }

  onKeyDown(e) {
    if (!this.isEnabled) return;
    // Avoid intercepting browser shortcuts if not actively controlling
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    // Prevent default for tab, alt, function keys to pass to remote desk
    if (["Tab", "Alt", "F1", "F5", "F11"].includes(e.key)) {
      e.preventDefault();
    }

    this.batchQueue.push({
      type: "key_down",
      key: e.key,
      code: e.code,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
    });
    this.flushBatch();
  }

  onKeyUp(e) {
    if (!this.isEnabled) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    this.batchQueue.push({
      type: "key_up",
      key: e.key,
      code: e.code,
    });
    this.flushBatch();
  }

  sendShortcut(name) {
    this.batchQueue.push({
      type: "shortcut",
      name,
    });
    this.flushBatch();
  }

  sendDirect(payload) {
    if (this.webrtc) {
      this.webrtc.send("control", payload);
    }
  }

  sendEvent(event) {
    this.sendDirect(event);
  }
}
