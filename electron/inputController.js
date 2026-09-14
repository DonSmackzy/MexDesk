// electron/inputController.js - Production Native Input Injection Engine for MexDesk
// Uses Win32 user32/kernel32 APIs via koffi for direct desktop input simulation

class InputController {
  constructor() {
    this.isWindows = process.platform === "win32";
    this.isNativeAvailable = false;
    this.screenSize = { width: 1920, height: 1080 };

    // Win32 API functions
    this.user32 = null;
    this.kernel32 = null;
    this.GetSystemMetrics = null;
    this.SetCursorPos = null;
    this.mouse_event = null;
    this.keybd_event = null;
    this.OpenInputDesktop = null;
    this.SetThreadDesktop = null;
    this.CloseDesktop = null;

    if (this.isWindows) {
      try {
        const koffi = require("koffi");
        this.user32 = koffi.load("user32.dll");
        this.kernel32 = koffi.load("kernel32.dll");

        this.GetSystemMetrics = this.user32.func("int GetSystemMetrics(int nIndex)");
        this.SetCursorPos = this.user32.func("int SetCursorPos(int X, int Y)");
        this.mouse_event = this.user32.func("void mouse_event(uint32 dwFlags, uint32 dx, uint32 dy, uint32 dwData, uintptr dwExtraInfo)");
        this.keybd_event = this.user32.func("void keybd_event(uint8 bVk, uint8 bScan, uint32 dwFlags, uintptr dwExtraInfo)");
        this.OpenInputDesktop = this.user32.func("uintptr OpenInputDesktop(uint32 dwFlags, int fInherit, uint32 dwDesiredAccess)");
        this.SetThreadDesktop = this.user32.func("int SetThreadDesktop(uintptr hDesktop)");
        this.CloseDesktop = this.user32.func("int CloseDesktop(uintptr hDesktop)");

        this.isNativeAvailable = true;
        this.refreshScreenMetrics();
        console.log(`[MexDesk Input] Native Win32 input injection initialized successfully (${this.screenSize.width}x${this.screenSize.height})`);
      } catch (err) {
        console.warn("[MexDesk Input] Native input injection unavailable:", err.message);
      }
    }
  }

  refreshScreenMetrics() {
    if (this.GetSystemMetrics) {
      const virtW = this.GetSystemMetrics(78) || this.GetSystemMetrics(0); // SM_CXVIRTUALSCREEN or SM_CXSCREEN
      const virtH = this.GetSystemMetrics(79) || this.GetSystemMetrics(1); // SM_CYVIRTUALSCREEN or SM_CYSCREEN
      if (virtW > 0 && virtH > 0) {
        this.screenSize = { width: virtW, height: virtH };
      }
    }
  }

  setScreenSize(width, height) {
    if (width > 0 && height > 0) {
      this.screenSize = { width, height };
    }
  }

  // Ensure current thread is attached to the interactive input desktop
  attachToInputDesktop() {
    if (!this.OpenInputDesktop || !this.SetThreadDesktop) return;
    try {
      const DESKTOP_ALL = 0x01FF;
      const hDesk = this.OpenInputDesktop(0, 0, DESKTOP_ALL);
      if (hDesk) {
        this.SetThreadDesktop(hDesk);
        // Do not immediately close hDesk while thread desktop is assigned to it
      }
    } catch (e) {
      // Ignore desktop switch failures
    }
  }

  translateCoords(normX, normY) {
    let originX = 0;
    let originY = 0;
    let screenW = this.screenSize.width;
    let screenH = this.screenSize.height;

    if (this.GetSystemMetrics) {
      originX = this.GetSystemMetrics(76); // SM_XVIRTUALSCREEN
      originY = this.GetSystemMetrics(77); // SM_YVIRTUALSCREEN
      const virtW = this.GetSystemMetrics(78); // SM_CXVIRTUALSCREEN
      const virtH = this.GetSystemMetrics(79); // SM_CYVIRTUALSCREEN
      if (virtW > 0 && virtH > 0) {
        screenW = virtW;
        screenH = virtH;
      }
    }

    const clampedX = Math.max(0.0, Math.min(1.0, normX));
    const clampedY = Math.max(0.0, Math.min(1.0, normY));

    const x = Math.round(originX + (clampedX * screenW));
    const y = Math.round(originY + (clampedY * screenH));
    return { x, y };
  }

  // Mouse constants
  static MOUSEEVENTF_MOVE = 0x0001;
  static MOUSEEVENTF_LEFTDOWN = 0x0002;
  static MOUSEEVENTF_LEFTUP = 0x0004;
  static MOUSEEVENTF_RIGHTDOWN = 0x0008;
  static MOUSEEVENTF_RIGHTUP = 0x0010;
  static MOUSEEVENTF_MIDDLEDOWN = 0x0020;
  static MOUSEEVENTF_MIDDLEUP = 0x0040;
  static MOUSEEVENTF_WHEEL = 0x0800;
  static KEYEVENTF_KEYUP = 0x0002;

  async handleEvent(event) {
    if (!event || !event.type) return;

    try {
      switch (event.type) {
        case "mouse_move":
          await this.handleMouseMove(event);
          break;
        case "mouse_down":
          await this.handleMouseDown(event);
          break;
        case "mouse_up":
          await this.handleMouseUp(event);
          break;
        case "mouse_click":
          await this.handleClick(event);
          break;
        case "mouse_dblclick":
          await this.handleDblClick(event);
          break;
        case "mouse_wheel":
          await this.handleScroll(event);
          break;
        case "key_down":
          await this.handleKeyDown(event);
          break;
        case "key_up":
          await this.handleKeyUp(event);
          break;
        case "shortcut":
          await this.handleShortcut(event);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error("[MexDesk Input] Native event dispatch error:", err.message);
    }
  }

  async handleMouseMove({ x, y }) {
    if (!this.SetCursorPos) return;
    if (x === undefined || y === undefined) return;
    const coords = this.translateCoords(x, y);
    this.SetCursorPos(coords.x, coords.y);
  }

  async handleMouseDown({ x, y, button }) {
    if (x !== undefined && y !== undefined && this.SetCursorPos) {
      const coords = this.translateCoords(x, y);
      this.SetCursorPos(coords.x, coords.y);
    }
    if (!this.mouse_event) return;
    const flag = button === 2
      ? InputController.MOUSEEVENTF_RIGHTDOWN
      : button === 1
      ? InputController.MOUSEEVENTF_MIDDLEDOWN
      : InputController.MOUSEEVENTF_LEFTDOWN;
    this.mouse_event(flag, 0, 0, 0, 0);
  }

  async handleMouseUp({ x, y, button }) {
    if (x !== undefined && y !== undefined && this.SetCursorPos) {
      const coords = this.translateCoords(x, y);
      this.SetCursorPos(coords.x, coords.y);
    }
    if (!this.mouse_event) return;
    const flag = button === 2
      ? InputController.MOUSEEVENTF_RIGHTUP
      : button === 1
      ? InputController.MOUSEEVENTF_MIDDLEUP
      : InputController.MOUSEEVENTF_LEFTUP;
    this.mouse_event(flag, 0, 0, 0, 0);
  }

  async handleClick({ x, y, button = 0 }) {
    await this.handleMouseDown({ x, y, button });
    await new Promise((r) => setTimeout(r, 40));
    await this.handleMouseUp({ x, y, button });
  }

  async handleDblClick({ x, y }) {
    await this.handleClick({ x, y, button: 0 });
    await new Promise((r) => setTimeout(r, 80));
    await this.handleClick({ x, y, button: 0 });
  }

  async handleScroll({ deltaY }) {
    if (!this.mouse_event) return;
    const wheelDelta = deltaY < 0 ? 120 : -120;
    this.mouse_event(InputController.MOUSEEVENTF_WHEEL, 0, 0, wheelDelta, 0);
  }

  async handleKeyDown({ code, key }) {
    if (!this.keybd_event) return;
    const vk = this.mapVirtualKey(code, key);
    if (vk) {
      this.keybd_event(vk, 0, 0, 0);
    }
  }

  async handleKeyUp({ code, key }) {
    if (!this.keybd_event) return;
    const vk = this.mapVirtualKey(code, key);
    if (vk) {
      this.keybd_event(vk, 0, InputController.KEYEVENTF_KEYUP, 0);
    }
  }

  async handleShortcut({ name }) {
    if (!this.keybd_event) return;
    if (name === "alt_tab") {
      const VK_ALT = 0x12;
      const VK_TAB = 0x09;
      this.keybd_event(VK_ALT, 0, 0, 0);
      this.keybd_event(VK_TAB, 0, 0, 0);
      this.keybd_event(VK_TAB, 0, InputController.KEYEVENTF_KEYUP, 0);
      this.keybd_event(VK_ALT, 0, InputController.KEYEVENTF_KEYUP, 0);
    }
  }

  mapVirtualKey(code, key) {
    // Alphanumeric keys (A-Z)
    if (code && code.startsWith("Key")) {
      const letter = code.slice(3).toUpperCase();
      return letter.charCodeAt(0);
    }

    // Number row (Digit0 - Digit9)
    if (code && code.startsWith("Digit")) {
      const digit = code.slice(5);
      return 0x30 + parseInt(digit, 10);
    }

    // Numpad digits (Numpad0 - Numpad9)
    if (code && code.startsWith("Numpad") && code.length === 7 && !isNaN(code.slice(6))) {
      const num = code.slice(6);
      return 0x60 + parseInt(num, 10);
    }

    // Function keys (F1 - F24)
    if (code && /^F([1-9]|1[0-9]|2[0-4])$/.test(code)) {
      const fNum = parseInt(code.slice(1), 10);
      return 0x70 + (fNum - 1);
    }

    // Explicit mapping table for standard codes
    const codeMap = {
      // Standard controls
      Enter: 0x0D,
      NumpadEnter: 0x0D,
      Escape: 0x1B,
      Backspace: 0x08,
      Tab: 0x09,
      Space: 0x20,

      // Navigation & editing
      Insert: 0x2D,
      Delete: 0x2E,
      Home: 0x24,
      End: 0x23,
      PageUp: 0x21,
      PageDown: 0x22,
      ArrowLeft: 0x25,
      ArrowUp: 0x26,
      ArrowRight: 0x27,
      ArrowDown: 0x28,

      // Modifiers
      ShiftLeft: 0x10,
      ShiftRight: 0x10,
      ControlLeft: 0x11,
      ControlRight: 0x11,
      AltLeft: 0x12,
      AltRight: 0x12,
      MetaLeft: 0x5B,
      MetaRight: 0x5C,
      ContextMenu: 0x5D,
      CapsLock: 0x14,
      NumLock: 0x90,
      ScrollLock: 0x91,

      // Punctuation / OEM
      Minus: 0xBD,
      Equal: 0xBB,
      BracketLeft: 0xDB,
      BracketRight: 0xDD,
      Backslash: 0xDC,
      Semicolon: 0xBA,
      Quote: 0xDE,
      Comma: 0xBC,
      Period: 0xBE,
      Slash: 0xBF,
      Backquote: 0xC0,

      // Numpad math
      NumpadAdd: 0x6B,
      NumpadSubtract: 0x6D,
      NumpadMultiply: 0x6A,
      NumpadDivide: 0x6F,
      NumpadDecimal: 0x6E,
    };

    if (code && codeMap[code]) {
      return codeMap[code];
    }

    // Fallback single character mapping
    if (key && key.length === 1) {
      const upper = key.toUpperCase();
      const codePoint = upper.charCodeAt(0);
      if (codePoint >= 0x41 && codePoint <= 0x5A) return codePoint; // A-Z
      if (codePoint >= 0x30 && codePoint <= 0x39) return codePoint; // 0-9
    }

    return null;
  }
}

module.exports = new InputController();
