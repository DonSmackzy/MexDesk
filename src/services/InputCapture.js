// InputCapture.js - Normalizes and transmits user input to remote desk

export class InputCapture {
  constructor(webrtc, targetElement) {
    this.webrtc = webrtc;
    this.targetElement = targetElement;
    this.isEnabled = false;
    this.lastMoveTime = 0;
    this.rafId = null;
    this.pendingMove = null;

    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundWheel = this.onWheel.bind(this);
    this.boundContextMenu = this.onContextMenu.bind(this);
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
  }

  attach(element) {
    this.targetElement = element;
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
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  getNormalizedCoords(event) {
    if (!this.targetElement) return { x: 0, y: 0 };
    const rect = this.targetElement.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    return { x, y };
  }

  onMouseMove(e) {
    if (!this.isEnabled) return;
    const coords = this.getNormalizedCoords(e);
    this.pendingMove = coords;

    const now = performance.now();
    if (now - this.lastMoveTime > 16) { // ~60fps throttle
      this.lastMoveTime = now;
      this.sendEvent({
        type: "mouse_move",
        x: coords.x,
        y: coords.y,
      });
      this.pendingMove = null;
    } else if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => {
        if (this.pendingMove) {
          this.sendEvent({
            type: "mouse_move",
            x: this.pendingMove.x,
            y: this.pendingMove.y,
          });
          this.pendingMove = null;
          this.lastMoveTime = performance.now();
        }
        this.rafId = null;
      });
    }
  }

  onMouseDown(e) {
    if (!this.isEnabled) return;
    const coords = this.getNormalizedCoords(e);
    this.sendEvent({
      type: "mouse_down",
      button: e.button,
      x: coords.x,
      y: coords.y,
    });
  }

  onMouseUp(e) {
    if (!this.isEnabled) return;
    const coords = this.getNormalizedCoords(e);
    this.sendEvent({
      type: "mouse_up",
      button: e.button,
      x: coords.x,
      y: coords.y,
    });
  }

  onWheel(e) {
    if (!this.isEnabled) return;
    e.preventDefault();
    this.sendEvent({
      type: "mouse_wheel",
      deltaX: e.deltaX,
      deltaY: e.deltaY,
    });
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

    this.sendEvent({
      type: "key_down",
      key: e.key,
      code: e.code,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
    });
  }

  onKeyUp(e) {
    if (!this.isEnabled) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    this.sendEvent({
      type: "key_up",
      key: e.key,
      code: e.code,
    });
  }

  sendShortcut(name) {
    this.sendEvent({
      type: "shortcut",
      name,
    });
  }

  sendEvent(event) {
    if (this.webrtc) {
      this.webrtc.send("control", event);
    }
  }
}
