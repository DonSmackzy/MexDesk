// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use tauri::WebviewWindow;
use windows::Win32::System::Shutdown::LockWorkStation;
use windows::Win32::UI::Input::KeyboardAndMouse::*;
use windows::Win32::UI::WindowsAndMessaging::*;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct InputEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub button: Option<serde_json::Value>,
    pub delta_x: Option<f64>,
    pub delta_y: Option<f64>,
    pub key: Option<String>,
    pub code: Option<String>,
    pub name: Option<String>,
    pub events: Option<Vec<InputEvent>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DisplayBounds {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DisplayInfo {
    pub id: String,
    pub name: String,
    pub is_primary: bool,
    pub bounds: DisplayBounds,
    pub source_id: String,
}

fn map_virtual_key(code: Option<&str>, key: Option<&str>) -> Option<u8> {
    if let Some(c) = code {
        // Security: Block OS Meta/Win keys from remote arbitrary execution
        if c == "MetaLeft" || c == "MetaRight" || c == "OSLeft" || c == "OSRight" {
            return None;
        }

        // Letter keys (KeyA - KeyZ)
        if c.starts_with("Key") && c.len() == 4 {
            let ch = c.chars().nth(3).unwrap().to_ascii_uppercase();
            return Some(ch as u8);
        }

        // Digit keys (Digit0 - Digit9)
        if c.starts_with("Digit") && c.len() == 6 {
            let ch = c.chars().nth(5).unwrap();
            if let Some(d) = ch.to_digit(10) {
                return Some(0x30 + d as u8);
            }
        }

        // Numpad digits (Numpad0 - Numpad9)
        if c.starts_with("Numpad") && c.len() == 7 {
            let ch = c.chars().nth(6).unwrap();
            if let Some(d) = ch.to_digit(10) {
                return Some(0x60 + d as u8);
            }
        }

        // Function keys (F1 - F24)
        if c.starts_with('F') && c.len() >= 2 {
            if let Ok(f_num) = c[1..].parse::<u8>() {
                if (1..=24).contains(&f_num) {
                    return Some(0x70 + (f_num - 1));
                }
            }
        }

        // Explicit standard keys mapping
        match c {
            "Enter" | "NumpadEnter" => return Some(0x0D),
            "Escape" => return Some(0x1B),
            "Backspace" => return Some(0x08),
            "Tab" => return Some(0x09),
            "Space" => return Some(0x20),
            "Insert" => return Some(0x2D),
            "Delete" => return Some(0x2E),
            "Home" => return Some(0x24),
            "End" => return Some(0x23),
            "PageUp" => return Some(0x21),
            "PageDown" => return Some(0x22),
            "ArrowLeft" => return Some(0x25),
            "ArrowUp" => return Some(0x26),
            "ArrowRight" => return Some(0x27),
            "ArrowDown" => return Some(0x28),
            "ShiftLeft" | "ShiftRight" => return Some(0x10),
            "ControlLeft" | "ControlRight" => return Some(0x11),
            "AltLeft" | "AltRight" => return Some(0x12),
            "ContextMenu" => return Some(0x5D),
            "CapsLock" => return Some(0x14),
            "NumLock" => return Some(0x90),
            "ScrollLock" => return Some(0x91),
            "Minus" => return Some(0xBD),
            "Equal" => return Some(0xBB),
            "BracketLeft" => return Some(0xDB),
            "BracketRight" => return Some(0xDD),
            "Backslash" => return Some(0xDC),
            "Semicolon" => return Some(0xBA),
            "Quote" => return Some(0xDE),
            "Comma" => return Some(0xBC),
            "Period" => return Some(0xBE),
            "Slash" => return Some(0xBF),
            "Backquote" => return Some(0xC0),
            "NumpadAdd" => return Some(0x6B),
            "NumpadSubtract" => return Some(0x6D),
            "NumpadMultiply" => return Some(0x6A),
            "NumpadDivide" => return Some(0x6F),
            "NumpadDecimal" => return Some(0x6E),
            _ => {}
        }
    }

    if let Some(k) = key {
        if k == "Meta" || k == "OS" {
            return None;
        }
        if k.len() == 1 {
            let ch = k.chars().next().unwrap().to_ascii_uppercase();
            if ch.is_ascii_alphanumeric() {
                return Some(ch as u8);
            }
        }
    }

    None
}

unsafe fn execute_single_input(event: &InputEvent) {
    let t = event.event_type.as_str();

    // 1. Mouse movement (supports "mouse_move" and "mousemove")
    if t == "mouse_move" || t == "mousemove" {
        if let (Some(nx), Some(ny)) = (event.x, event.y) {
            let origin_x = GetSystemMetrics(SM_XVIRTUALSCREEN);
            let origin_y = GetSystemMetrics(SM_YVIRTUALSCREEN);
            let virt_w = GetSystemMetrics(SM_CXVIRTUALSCREEN);
            let virt_h = GetSystemMetrics(SM_CYVIRTUALSCREEN);

            let screen_w = if virt_w > 0 { virt_w } else { GetSystemMetrics(SM_CXSCREEN) };
            let screen_h = if virt_h > 0 { virt_h } else { GetSystemMetrics(SM_CYSCREEN) };

            let target_x = origin_x + (nx.clamp(0.0, 1.0) * screen_w as f64).round() as i32;
            let target_y = origin_y + (ny.clamp(0.0, 1.0) * screen_h as f64).round() as i32;

            let _ = SetCursorPos(target_x, target_y);
        }
        return;
    }

    // 2. Mouse down / click start (supports "mouse_down" and "mousedown")
    if t == "mouse_down" || t == "mousedown" {
        if let (Some(nx), Some(ny)) = (event.x, event.y) {
            let origin_x = GetSystemMetrics(SM_XVIRTUALSCREEN);
            let origin_y = GetSystemMetrics(SM_YVIRTUALSCREEN);
            let virt_w = GetSystemMetrics(SM_CXVIRTUALSCREEN);
            let virt_h = GetSystemMetrics(SM_CYVIRTUALSCREEN);
            let screen_w = if virt_w > 0 { virt_w } else { GetSystemMetrics(SM_CXSCREEN) };
            let screen_h = if virt_h > 0 { virt_h } else { GetSystemMetrics(SM_CYSCREEN) };
            let target_x = origin_x + (nx.clamp(0.0, 1.0) * screen_w as f64).round() as i32;
            let target_y = origin_y + (ny.clamp(0.0, 1.0) * screen_h as f64).round() as i32;
            let _ = SetCursorPos(target_x, target_y);
        }

        let flags = match &event.button {
            Some(serde_json::Value::Number(n)) => match n.as_i64() {
                Some(2) => MOUSEEVENTF_RIGHTDOWN,
                Some(1) => MOUSEEVENTF_MIDDLEDOWN,
                _ => MOUSEEVENTF_LEFTDOWN,
            },
            Some(serde_json::Value::String(s)) => match s.as_str() {
                "right" => MOUSEEVENTF_RIGHTDOWN,
                "middle" => MOUSEEVENTF_MIDDLEDOWN,
                _ => MOUSEEVENTF_LEFTDOWN,
            },
            _ => MOUSEEVENTF_LEFTDOWN,
        };
        mouse_event(flags, 0, 0, 0, 0);
        return;
    }

    // 3. Mouse up / click release (supports "mouse_up" and "mouseup")
    if t == "mouse_up" || t == "mouseup" {
        let flags = match &event.button {
            Some(serde_json::Value::Number(n)) => match n.as_i64() {
                Some(2) => MOUSEEVENTF_RIGHTUP,
                Some(1) => MOUSEEVENTF_MIDDLEUP,
                _ => MOUSEEVENTF_LEFTUP,
            },
            Some(serde_json::Value::String(s)) => match s.as_str() {
                "right" => MOUSEEVENTF_RIGHTUP,
                "middle" => MOUSEEVENTF_MIDDLEUP,
                _ => MOUSEEVENTF_LEFTUP,
            },
            _ => MOUSEEVENTF_LEFTUP,
        };
        mouse_event(flags, 0, 0, 0, 0);
        return;
    }

    // 4. Mouse wheel (supports "mouse_wheel" and "wheel")
    if t == "mouse_wheel" || t == "wheel" {
        if let Some(dy) = event.delta_y {
            let wheel_delta: i32 = if dy < 0.0 { 120 } else { -120 };
            mouse_event(MOUSEEVENTF_WHEEL, 0, 0, wheel_delta, 0);
        }
        return;
    }

    // 5. Keyboard down (supports "key_down" and "keydown")
    if t == "key_down" || t == "keydown" {
        if let Some(vk) = map_virtual_key(event.code.as_deref(), event.key.as_deref()) {
            keybd_event(vk, 0, KEYBD_EVENT_FLAGS(0), 0);
        }
        return;
    }

    // 6. Keyboard up (supports "key_up" and "keyup")
    if t == "key_up" || t == "keyup" {
        if let Some(vk) = map_virtual_key(event.code.as_deref(), event.key.as_deref()) {
            keybd_event(vk, 0, KEYEVENTF_KEYUP, 0);
        }
        return;
    }

    // 7. Shortcut injection
    if t == "shortcut" {
        if let Some(name) = event.name.as_deref() {
            if name == "win-l" {
                let _ = LockWorkStation();
            } else if name == "alt_tab" {
                const VK_ALT: u8 = 0x12;
                const VK_TAB: u8 = 0x09;
                keybd_event(VK_ALT, 0, KEYBD_EVENT_FLAGS(0), 0);
                keybd_event(VK_TAB, 0, KEYBD_EVENT_FLAGS(0), 0);
                keybd_event(VK_TAB, 0, KEYEVENTF_KEYUP, 0);
                keybd_event(VK_ALT, 0, KEYEVENTF_KEYUP, 0);
            }
        }
    }
}

// Low-latency Native Mouse & Keyboard Injection
#[tauri::command]
fn send_input(event: InputEvent) -> Result<(), String> {
    unsafe {
        if event.event_type == "batch" {
            if let Some(sub_events) = event.events {
                for ev in sub_events {
                    execute_single_input(&ev);
                }
            }
        } else {
            execute_single_input(&event);
        }
    }
    Ok(())
}

// Window control commands
#[tauri::command]
fn window_minimize(window: WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn window_maximize(window: WebviewWindow) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn window_close(window: WebviewWindow) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
fn lock_workstation() -> Result<(), String> {
    unsafe {
        LockWorkStation().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_displays() -> Result<Vec<DisplayInfo>, String> {
    unsafe {
        let screen_w = GetSystemMetrics(SM_CXSCREEN);
        let screen_h = GetSystemMetrics(SM_CYSCREEN);
        Ok(vec![DisplayInfo {
            id: "primary".to_string(),
            name: "Primary Monitor".to_string(),
            is_primary: true,
            bounds: DisplayBounds {
                x: 0,
                y: 0,
                width: screen_w,
                height: screen_h,
            },
            source_id: "screen:0:0".to_string(),
        }])
    }
}

fn main() {
    // Seamless primary screen capture in WebView2 with ZERO picker prompts (AnyDesk parity)
    let existing_args = std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS").unwrap_or_default();
    let capture_args = "--auto-select-desktop-capture-source=Screen --enable-usermedia-screen-capturing --use-fake-ui-for-media-stream";
    let combined_args = if existing_args.is_empty() {
        capture_args.to_string()
    } else {
        format!("{} {}", existing_args, capture_args)
    };
    std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", combined_args);

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            send_input,
            window_minimize,
            window_maximize,
            window_close,
            lock_workstation,
            get_displays
        ])
        .run(tauri::generate_context!())
        .expect("error while running AegisDesk tauri application");
}
