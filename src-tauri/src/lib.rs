use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State,
};

mod audio;
mod tts;
mod transcription_server;

// Application state
#[derive(Default)]
pub struct AppState {
    pub is_listening: bool,
    pub is_speaking: bool,
    pub is_processing: bool,
    pub current_session_id: Option<String>,
}

pub type SharedState = Arc<Mutex<AppState>>;

// Voice state enum for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VoiceState {
    Idle,
    Listening,
    Processing,
    Speaking,
}

// Settings struct
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub stt_engine: String,
    pub push_to_talk_hotkey: String,
    pub continuous_mode_hotkey: String,
    pub interrupt_hotkey: String,
    pub tts_engine: String,
    pub tts_voice: String,
    pub tts_speed: f32,
    pub server_url: String,
    pub model: String,
    pub agent: String,
    pub confirm_file_writes: bool,
    pub confirm_shell_commands: bool,
    pub confirm_git_operations: bool,
    pub show_floating_panel: bool,
    pub play_sound_on_response: bool,
    pub auto_start_on_login: bool,
    pub panel_position: String,
    pub panel_opacity: f32,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            stt_engine: "superwhisper".to_string(),
            push_to_talk_hotkey: "Option+Space".to_string(),
            continuous_mode_hotkey: "Option+Shift+Space".to_string(),
            interrupt_hotkey: "Escape".to_string(),
            tts_engine: "macos".to_string(),
            tts_voice: "Samantha".to_string(),
            tts_speed: 1.0,
            server_url: "http://localhost:4096".to_string(),
            model: "anthropic/claude-sonnet-4-20250514".to_string(),
            agent: "default".to_string(),
            confirm_file_writes: true,
            confirm_shell_commands: true,
            confirm_git_operations: true,
            show_floating_panel: true,
            play_sound_on_response: true,
            auto_start_on_login: false,
            panel_position: "top-right".to_string(),
            panel_opacity: 0.95,
        }
    }
}

// Get the current voice state
#[tauri::command]
fn get_voice_state(state: State<SharedState>) -> VoiceState {
    let app_state = state.lock().unwrap();
    if app_state.is_listening {
        VoiceState::Listening
    } else if app_state.is_processing {
        VoiceState::Processing
    } else if app_state.is_speaking {
        VoiceState::Speaking
    } else {
        VoiceState::Idle
    }
}

// Set voice state
#[tauri::command]
fn set_voice_state(state: State<SharedState>, voice_state: VoiceState, app_handle: AppHandle) {
    let mut app_state = state.lock().unwrap();
    
    match voice_state {
        VoiceState::Idle => {
            app_state.is_listening = false;
            app_state.is_processing = false;
            app_state.is_speaking = false;
        }
        VoiceState::Listening => {
            app_state.is_listening = true;
            app_state.is_processing = false;
            app_state.is_speaking = false;
        }
        VoiceState::Processing => {
            app_state.is_listening = false;
            app_state.is_processing = true;
            app_state.is_speaking = false;
        }
        VoiceState::Speaking => {
            app_state.is_listening = false;
            app_state.is_processing = false;
            app_state.is_speaking = true;
        }
    }
    
    // Emit state change to frontend
    let _ = app_handle.emit("voice-state-changed", &voice_state);
    
    // Update tray icon based on state
    update_tray_icon(&app_handle, &voice_state);
}

// Update tray icon based on voice state
fn update_tray_icon(app_handle: &AppHandle, state: &VoiceState) {
    if let Some(tray) = app_handle.tray_by_id("main-tray") {
        let icon_name = match state {
            VoiceState::Idle => "icon.png",
            VoiceState::Listening => "icon-listening.png",
            VoiceState::Processing => "icon-processing.png",
            VoiceState::Speaking => "icon-speaking.png",
        };
        
        // Try to load the icon, fall back to default if not found
        if let Ok(icon) = Image::from_path(format!("icons/{}", icon_name)) {
            let _ = tray.set_icon(Some(icon));
        }
    }
}

// Set current session ID
#[tauri::command]
fn set_session_id(state: State<SharedState>, session_id: Option<String>) {
    let mut app_state = state.lock().unwrap();
    app_state.current_session_id = session_id;
}

// Get current session ID
#[tauri::command]
fn get_session_id(state: State<SharedState>) -> Option<String> {
    let app_state = state.lock().unwrap();
    app_state.current_session_id.clone()
}

// Speak text using TTS (delegates to the tts module)
#[tauri::command]
async fn speak(
    text: String,
    engine: String,
    voice: String,
    speed: f32,
    state: State<'_, SharedState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    // Set speaking state
    {
        let mut app_state = state.lock().unwrap();
        app_state.is_speaking = true;
    }
    let _ = app_handle.emit("voice-state-changed", VoiceState::Speaking);
    
    // Perform TTS
    let result = tts::speak(&text, &engine, &voice, speed).await;
    
    // Reset speaking state
    {
        let mut app_state = state.lock().unwrap();
        app_state.is_speaking = false;
    }
    let _ = app_handle.emit("voice-state-changed", VoiceState::Idle);
    
    result
}

// Stop any currently playing audio
#[tauri::command]
async fn stop_speaking(state: State<'_, SharedState>, app_handle: AppHandle) -> Result<(), String> {
    // Clear the audio queue and stop current playback
    tts::clear_audio_queue().await?;
    tts::stop_speaking().await?;
    
    let mut app_state = state.lock().unwrap();
    app_state.is_speaking = false;
    
    let _ = app_handle.emit("voice-state-changed", VoiceState::Idle);
    
    Ok(())
}

// Generate and queue a single sentence for TTS playback (for streaming)
#[tauri::command]
async fn speak_sentence(
    text: String,
    voice: String,
    speed: f32,
    engine: String,
) -> Result<(), String> {
    tts::speak_sentence(&text, &voice, speed, &engine).await
}

// Show the main floating panel
#[tauri::command]
fn show_panel(app_handle: AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

// Hide the main floating panel
#[tauri::command]
fn hide_panel(app_handle: AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.hide();
    }
}

// Toggle the main floating panel
#[tauri::command]
fn toggle_panel(app_handle: AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

// Show settings window
#[tauri::command]
fn show_settings(app_handle: AppHandle) {
    if let Some(window) = app_handle.get_webview_window("settings") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

// Hide settings window
#[tauri::command]
fn hide_settings(app_handle: AppHandle) {
    if let Some(window) = app_handle.get_webview_window("settings") {
        let _ = window.hide();
    }
}

// Get SuperWhisper recordings directory
#[tauri::command]
fn get_superwhisper_dir() -> Option<String> {
    if let Some(home) = dirs::home_dir() {
        let sw_dir = home.join("Library/Application Support/superwhisper/recordings");
        if sw_dir.exists() {
            return sw_dir.to_str().map(|s| s.to_string());
        }
    }
    None
}

// Get Macrowhisper config path
#[tauri::command]
fn get_macrowhisper_config_path() -> Option<String> {
    if let Some(home) = dirs::home_dir() {
        let config_path = home.join(".config/macrowhisper/macrowhisper.json");
        return config_path.to_str().map(|s| s.to_string());
    }
    None
}

// Check if an application is installed
#[tauri::command]
fn is_app_installed(app_name: &str) -> bool {
    let applications_path = format!("/Applications/{}.app", app_name);
    std::path::Path::new(&applications_path).exists()
}

// Check if a command exists in PATH
#[tauri::command]
fn is_command_available(command: &str) -> bool {
    std::process::Command::new("which")
        .arg(command)
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

// Play a notification sound
#[tauri::command]
async fn play_notification_sound(sound_name: String) -> Result<(), String> {
    audio::play_system_sound(&sound_name).await
}

// ============================================================================
// Setup Wizard Commands
// ============================================================================

// Check if SuperWhisper is installed
#[tauri::command]
fn is_superwhisper_installed() -> bool {
    std::path::Path::new("/Applications/superwhisper.app").exists()
}

// Get SuperWhisper hotkey from macOS defaults
// Returns human-readable format like "⌘Space" or None if not found
#[tauri::command]
fn get_superwhisper_hotkey() -> Option<String> {
    let output = std::process::Command::new("defaults")
        .args(["read", "com.superduper.superwhisper", "KeyboardShortcuts_pushToTalk"])
        .output()
        .ok()?;
    
    if !output.status.success() {
        return None;
    }
    
    let json_str = String::from_utf8(output.stdout).ok()?;
    decode_superwhisper_hotkey(&json_str.trim())
}

// Decode SuperWhisper hotkey JSON to human-readable format
fn decode_superwhisper_hotkey(json: &str) -> Option<String> {
    // Parse JSON like: {"carbonKeyCode":49,"carbonModifiers":256,"mouseButtonNumbers":[]}
    let parsed: serde_json::Value = serde_json::from_str(json).ok()?;
    
    let key_code = parsed.get("carbonKeyCode")?.as_u64()? as u32;
    let modifiers = parsed.get("carbonModifiers")?.as_u64()? as u32;
    
    let mut parts = Vec::new();
    
    // Carbon modifier flags (in standard macOS order)
    if modifiers & 4096 != 0 { parts.push("⌃"); }  // control
    if modifiers & 2048 != 0 { parts.push("⌥"); }  // option
    if modifiers & 512 != 0 { parts.push("⇧"); }   // shift
    if modifiers & 256 != 0 { parts.push("⌘"); }   // command
    
    // Common Carbon key codes
    let key_name = match key_code {
        0 => "A", 1 => "S", 2 => "D", 3 => "F", 4 => "H", 5 => "G", 6 => "Z", 7 => "X",
        8 => "C", 9 => "V", 11 => "B", 12 => "Q", 13 => "W", 14 => "E", 15 => "R",
        16 => "Y", 17 => "T", 18 => "1", 19 => "2", 20 => "3", 21 => "4", 22 => "6",
        23 => "5", 24 => "=", 25 => "9", 26 => "7", 27 => "-", 28 => "8", 29 => "0",
        31 => "O", 32 => "U", 34 => "I", 35 => "P", 37 => "L", 38 => "J", 40 => "K",
        45 => "N", 46 => "M", 49 => "Space", 53 => "Escape",
        122 => "F1", 120 => "F2", 99 => "F3", 118 => "F4", 96 => "F5",
        97 => "F6", 98 => "F7", 100 => "F8", 101 => "F9", 109 => "F10",
        103 => "F11", 111 => "F12",
        _ => return None,
    };
    
    parts.push(key_name);
    Some(parts.join(""))
}

// Check if Macrowhisper is installed (command available in PATH)
#[tauri::command]
fn is_macrowhisper_installed() -> bool {
    std::process::Command::new("which")
        .arg("macrowhisper")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

// Check if Macrowhisper service is running
#[tauri::command]
fn is_macrowhisper_running() -> bool {
    let output = std::process::Command::new("macrowhisper")
        .arg("--service-status")
        .output();
    
    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            stdout.contains("Running: Yes")
        }
        Err(_) => false,
    }
}

// Check if Macrowhisper is configured with our opencodeTalk action
#[tauri::command]
fn is_macrowhisper_configured() -> bool {
    if let Some(home) = dirs::home_dir() {
        let config_path = home.join(".config/macrowhisper/macrowhisper.json");
        if let Ok(content) = std::fs::read_to_string(&config_path) {
            return content.contains("opencodeTalk");
        }
    }
    false
}

// Check if Homebrew is installed
#[tauri::command]
fn is_homebrew_installed() -> bool {
    // Check common Homebrew locations
    std::path::Path::new("/opt/homebrew/bin/brew").exists() ||
    std::path::Path::new("/usr/local/bin/brew").exists() ||
    std::process::Command::new("which")
        .arg("brew")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

// Configure Macrowhisper with our opencodeTalk action
#[tauri::command]
async fn configure_macrowhisper() -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let config_dir = home.join(".config/macrowhisper");
    let config_path = config_dir.join("macrowhisper.json");
    
    // Create config directory if it doesn't exist
    std::fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config directory: {}", e))?;
    
    // Read existing config or create new one
    let mut config: serde_json::Value = if config_path.exists() {
        let content = std::fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read config: {}", e))?;
        serde_json::from_str(&content).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    
    // Set up defaults if not present
    if config.get("defaults").is_none() {
        config["defaults"] = serde_json::json!({});
    }
    config["defaults"]["activeAction"] = serde_json::json!("opencodeTalk");
    config["defaults"]["pressReturn"] = serde_json::json!(false);
    config["defaults"]["actionDelay"] = serde_json::json!(0.3);
    
    // Add our shell action
    if config.get("scriptsShell").is_none() {
        config["scriptsShell"] = serde_json::json!({});
    }
    config["scriptsShell"]["opencodeTalk"] = serde_json::json!({
        "action": "curl -s -X POST http://127.0.0.1:7891/transcription -H 'Content-Type: application/json' -d '{\"text\": \"{{swResult}}\"}'",
        "icon": "🎤"
    });
    
    // Write config
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    std::fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write config: {}", e))?;
    
    Ok(())
}

// Start Macrowhisper service
#[tauri::command]
async fn start_macrowhisper_service() -> Result<String, String> {
    let output = std::process::Command::new("macrowhisper")
        .arg("--start-service")
        .output()
        .map_err(|e| format!("Failed to start service: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    
    if output.status.success() {
        Ok(stdout)
    } else {
        Err(format!("Service start failed: {}{}", stdout, stderr))
    }
}

// Open SuperWhisper application
#[tauri::command]
fn open_superwhisper() -> Result<(), String> {
    std::process::Command::new("open")
        .args(["-a", "SuperWhisper"])
        .spawn()
        .map_err(|e| format!("Failed to open SuperWhisper: {}", e))?;
    Ok(())
}

// Open System Settings to Keyboard pane (for dictation setup)
#[tauri::command]
fn open_keyboard_settings() -> Result<(), String> {
    std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.Keyboard-Settings.extension")
        .spawn()
        .map_err(|e| format!("Failed to open settings: {}", e))?;
    Ok(())
}

// Open a URL in the default browser
#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(&url)
        .spawn()
        .map_err(|e| format!("Failed to open URL: {}", e))?;
    Ok(())
}

// Show the setup wizard window
#[tauri::command]
fn show_setup_window(app_handle: AppHandle) {
    if let Some(window) = app_handle.get_webview_window("setup") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

// Hide the setup wizard window
#[tauri::command]
fn hide_setup_window(app_handle: AppHandle) {
    if let Some(window) = app_handle.get_webview_window("setup") {
        let _ = window.hide();
    }
}

// Finish setup: close setup window, show main window
#[tauri::command]
fn finish_setup(app_handle: AppHandle) {
    if let Some(setup) = app_handle.get_webview_window("setup") {
        let _ = setup.hide();
    }
    if let Some(main) = app_handle.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
}

// ============================================================================
// End Setup Wizard Commands
// ============================================================================

// Start the Kokoro TTS server (keeps model warm for fast generation)
fn start_kokoro_server() {
    use std::process::{Command, Stdio};
    
    // Get the path to the kokoro server script
    let script_path = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .map(|p| p.join("../Resources/scripts/kokoro_server.py"))
        .unwrap_or_else(|| std::path::PathBuf::from("scripts/kokoro_server.py"));
    
    // Also try relative to the binary for development
    let dev_script_path = std::path::PathBuf::from("scripts/kokoro_server.py");
    
    let final_path = if script_path.exists() {
        script_path
    } else if dev_script_path.exists() {
        dev_script_path
    } else {
        std::path::PathBuf::from("src-tauri/scripts/kokoro_server.py")
    };
    
    std::thread::spawn(move || {
        let _ = Command::new("python3")
            .arg(&final_path)
            .env("KOKORO_PORT", "7892")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn();
    });
}

// Setup the tray icon and menu
fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItem::with_id(app, "show", "Show Panel", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings...", true, None::<&str>)?;
    let separator = MenuItem::with_id(app, "sep", "---", false, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit OpenCode Talk", true, None::<&str>)?;
    
    let menu = Menu::with_items(app, &[&show_item, &settings_item, &separator, &quit_item])?;
    
    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "settings" => {
                if let Some(window) = app.get_webview_window("settings") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state: SharedState = Arc::new(Mutex::new(AppState::default()));
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            get_voice_state,
            set_voice_state,
            set_session_id,
            get_session_id,
            speak,
            speak_sentence,
            stop_speaking,
            show_panel,
            hide_panel,
            toggle_panel,
            show_settings,
            hide_settings,
            get_superwhisper_dir,
            get_macrowhisper_config_path,
            is_app_installed,
            is_command_available,
            play_notification_sound,
            // Setup wizard commands
            is_superwhisper_installed,
            get_superwhisper_hotkey,
            is_macrowhisper_installed,
            is_macrowhisper_running,
            is_macrowhisper_configured,
            is_homebrew_installed,
            configure_macrowhisper,
            start_macrowhisper_service,
            open_superwhisper,
            open_keyboard_settings,
            open_external_url,
            show_setup_window,
            hide_setup_window,
            finish_setup,
        ])
        .setup(|app| {
            // Setup tray icon
            if let Err(e) = setup_tray(app.handle()) {
                eprintln!("Failed to setup tray: {}", e);
            }
            
            // Start the transcription server for Macrowhisper integration
            transcription_server::start_server(app.handle().clone());
            
            // Initialize the audio player for streaming TTS
            tauri::async_runtime::spawn(async {
                tts::init_audio_player().await;
            });
            
            // Start Kokoro TTS server (keeps model warm for fast generation)
            start_kokoro_server();
            
            // TODO: Check if setup is completed and show appropriate window
            // For now, show setup window for testing
            if let Some(window) = app.get_webview_window("setup") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            
            // Hide main window on startup (will be shown after setup)
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.hide();
            }
            
            // Hide settings window on startup
            if let Some(window) = app.get_webview_window("settings") {
                let _ = window.hide();
            }
            
            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                // Hide window instead of closing (menu bar app behavior)
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    let _ = window.hide();
                    api.prevent_close();
                }
                // Clean up when app is actually destroyed (e.g., via Quit)
                tauri::WindowEvent::Destroyed => {
                    if window.label() == "main" {
                        cleanup_all();
                    }
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Clean up all resources on app exit
fn cleanup_all() {
    // Gracefully shutdown the audio player thread
    tts::shutdown_audio_player();
    
    // Kill the Kokoro TTS server process
    use std::process::Command;
    let _ = Command::new("pkill")
        .args(["-f", "kokoro_server.py"])
        .output();
}
