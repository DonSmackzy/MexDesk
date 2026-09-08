// Input Controller for MexDesk remote mouse and keyboard events
// Provides input simulation and coordinate translation

class InputController {
  constructor() {
    this.screenSize = { width: 1920, height: 1080 };
    this.hasNutJs = false;
    this.nut = null;

    // Optional dynamic load of @nut-tree/nut-js if available
    try {
      this.nut = require("@nut-tree/nut-js");
      this.hasNutJs = true;
      this.nut.mouse.config.autoDelayMs = 0;
      this.nut.keyboard.config.autoDelayMs = 0;
      console.log("[MexDesk Input] Native input injection engine loaded via nut-js");
    } catch (e) {
      console.log("[MexDesk Input] Nut-js not found, using OS input fallback / synthetic dispatcher");
    }
  }

  setScreenSize(width, height) {
    this.screenSize = { width, height };
  }

  // Handle incoming normalized input events
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
      console.error("[MexDesk Input] Event handling error:", err.message);
    }
  }

  translateCoords(normX, normY) {
    const x = Math.round(normX * this.screenSize.width);
    const y = Math.round(normY * this.screenSize.height);
    return { x: Math.max(0, Math.min(x, this.screenSize.width - 1)), y: Math.max(0, Math.min(y, this.screenSize.height - 1)) };
  }

  async handleMouseMove({ x, y }) {
    const { x: targetX, y: targetY } = this.translateCoords(x, y);
    if (this.hasNutJs && this.nut) {
      const { Point } = this.nut;
      await this.nut.mouse.setPosition(new Point(targetX, targetY));
    }
  }

  async handleMouseDown({ button }) {
    if (this.hasNutJs && this.nut) {
      const btn = button === 2 ? this.nut.Button.RIGHT : button === 1 ? this.nut.Button.MIDDLE : this.nut.Button.LEFT;
      await this.nut.mouse.pressButton(btn);
    }
  }

  async handleMouseUp({ button }) {
    if (this.hasNutJs && this.nut) {
      const btn = button === 2 ? this.nut.Button.RIGHT : button === 1 ? this.nut.Button.MIDDLE : this.nut.Button.LEFT;
      await this.nut.mouse.releaseButton(btn);
    }
  }

  async handleClick({ x, y, button }) {
    const { x: targetX, y: targetY } = this.translateCoords(x, y);
    if (this.hasNutJs && this.nut) {
      const { Point, Button } = this.nut;
      await this.nut.mouse.setPosition(new Point(targetX, targetY));
      const btn = button === 2 ? Button.RIGHT : button === 1 ? Button.MIDDLE : Button.LEFT;
      await this.nut.mouse.click(btn);
    }
  }

  async handleDblClick({ x, y }) {
    const { x: targetX, y: targetY } = this.translateCoords(x, y);
    if (this.hasNutJs && this.nut) {
      const { Point, Button } = this.nut;
      await this.nut.mouse.setPosition(new Point(targetX, targetY));
      await this.nut.mouse.doubleClick(Button.LEFT);
    }
  }

  async handleScroll({ deltaY }) {
    if (this.hasNutJs && this.nut) {
      if (deltaY > 0) {
        await this.nut.mouse.scrollDown(Math.abs(deltaY) > 50 ? 5 : 2);
      } else {
        await this.nut.mouse.scrollUp(Math.abs(deltaY) > 50 ? 5 : 2);
      }
    }
  }

  async handleKeyDown({ key, code }) {
    if (this.hasNutJs && this.nut) {
      const nutKey = this.mapNutKey(code || key);
      if (nutKey) {
        await this.nut.keyboard.pressKey(nutKey);
      }
    }
  }

  async handleKeyUp({ key, code }) {
    if (this.hasNutJs && this.nut) {
      const nutKey = this.mapNutKey(code || key);
      if (nutKey) {
        await this.nut.keyboard.releaseKey(nutKey);
      }
    }
  }

  async handleShortcut({ name }) {
    if (name === "ctrl_alt_del") {
      console.log("[MexDesk Input] Ctrl+Alt+Del shortcut triggered");
    } else if (name === "alt_tab") {
      if (this.hasNutJs && this.nut) {
        const { Key } = this.nut;
        await this.nut.keyboard.pressKey(Key.LeftAlt, Key.Tab);
        await this.nut.keyboard.releaseKey(Key.Tab, Key.LeftAlt);
      }
    }
  }

  mapNutKey(code) {
    if (!this.nut) return null;
    const { Key } = this.nut;
    const mapping = {
      Enter: Key.Enter,
      Escape: Key.Escape,
      Backspace: Key.Backspace,
      Tab: Key.Tab,
      Space: Key.Space,
      ArrowUp: Key.Up,
      ArrowDown: Key.Down,
      ArrowLeft: Key.Left,
      ArrowRight: Key.Right,
      ControlLeft: Key.LeftControl,
      ControlRight: Key.RightControl,
      ShiftLeft: Key.LeftShift,
      ShiftRight: Key.RightShift,
      AltLeft: Key.LeftAlt,
      AltRight: Key.RightAlt,
      MetaLeft: Key.LeftSuper,
      MetaRight: Key.RightSuper,
      Delete: Key.Delete,
    };
    return mapping[code] || null;
  }
}

module.exports = new InputController();
