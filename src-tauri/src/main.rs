// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use tauri::WebviewWindow;
use windows::Win32::System::Shutdown::LockWorkStation;
use windows::Win32::UI::Input::KeyboardAndMouse::*;
use windows::Win32::UI::WindowsAndMessaging::*;

#[derive(Debug, Deserialize, Serialize)]
pub struct InputEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub button: Option<String>,
    pub delta_x: Option<f64>,
    pub delta_y: Option<f64>,
    pub key: Option<String>,
    pub key_code: Option<u32>,
    pub name: Option<String>,
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

// Low-latency Native Mouse & Keyboard Injection
#[tauri::command]
fn send_input(event: InputEvent) -> Result<(), String> {
    unsafe {
        match event.event_type.as_str() {
            "mousemove" => {
                if let (Some(nx), Some(ny)) = (event.x, event.y) {
                    let abs_x = ((nx * 65535.0).max(0.0).min(65535.0)) as i32;
                    let abs_y = ((ny * 65535.0).max(0.0).min(65535.0)) as i32;

                    let input = INPUT {
                        r#type: INPUT_MOUSE,
                        Anonymous: INPUT_0 {
                            mi: MOUSEINPUT {
                                dx: abs_x,
                                dy: abs_y,
                                mouseData: 0,
                                dwFlags: MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_MOVE,
                                time: 0,
                                dwExtraInfo: 0,
                            },
                        },
                    };
                    SendInput(&[input], std::mem::size_of::<INPUT>() as i32);
                }
            }
            "mousedown" => {
                let flags = match event.button.as_deref() {
                    Some("right") => MOUSEEVENTF_RIGHTDOWN,
                    Some("middle") => MOUSEEVENTF_MIDDLEDOWN,
                    _ => MOUSEEVENTF_LEFTDOWN,
                };
                let input = INPUT {
                    r#type: INPUT_MOUSE,
                    Anonymous: INPUT_0 {
                        mi: MOUSEINPUT {
                            dx: 0,
                            dy: 0,
                            mouseData: 0,
                            dwFlags: flags,
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                };
                SendInput(&[input], std::mem::size_of::<INPUT>() as i32);
            }
            "mouseup" => {
                let flags = match event.button.as_deref() {
                    Some("right") => MOUSEEVENTF_RIGHTUP,
                    Some("middle") => MOUSEEVENTF_MIDDLEUP,
                    _ => MOUSEEVENTF_LEFTUP,
                };
                let input = INPUT {
                    r#type: INPUT_MOUSE,
                    Anonymous: INPUT_0 {
                        mi: MOUSEINPUT {
                            dx: 0,
                            dy: 0,
                            mouseData: 0,
                            dwFlags: flags,
                            time: 0,
                            dwExtraInfo: 0,
                        },
                    },
                };
                SendInput(&[input], std::mem::size_of::<INPUT>() as i32);
            }
            "wheel" => {
                if let Some(dy) = event.delta_y {
                    let input = INPUT {
                        r#type: INPUT_MOUSE,
                        Anonymous: INPUT_0 {
                            mi: MOUSEINPUT {
                                dx: 0,
                                dy: 0,
                                mouseData: if dy > 0.0 { -120 } else { 120 } as u32,
                                dwFlags: MOUSEEVENTF_WHEEL,
                                time: 0,
                                dwExtraInfo: 0,
                            },
                        },
                    };
                    SendInput(&[input], std::mem::size_of::<INPUT>() as i32);
                }
            }
            "shortcut" => {
                if let Some(name) = event.name.as_deref() {
                    if name == "win-l" {
                        let _ = LockWorkStation();
                    }
                }
            }
            _ => {}
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
    let capture_args = "--auto-select-desktop-capture-source=\"Entire screen\" --enable-usermedia-screen-capturing --use-fake-ui-for-media-stream";
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
