use std::process::Stdio;
use std::collections::HashSet;
use tokio::process::Command;
use tokio::sync::{Mutex, mpsc, watch};
use std::sync::Arc;
use once_cell::sync::Lazy;

// Global state for tracking spawned process PIDs (fixes system-wide pkill issue)
static SPAWNED_PIDS: Lazy<Arc<Mutex<HashSet<u32>>>> = 
    Lazy::new(|| Arc::new(Mutex::new(HashSet::new())));

// Global state for tracking the current TTS process
static CURRENT_PROCESS: Lazy<Arc<Mutex<Option<tokio::process::Child>>>> = 
    Lazy::new(|| Arc::new(Mutex::new(None)));

// Audio queue for streaming TTS playback - now takes generation tasks
static GENERATION_QUEUE: Lazy<Arc<Mutex<Option<mpsc::Sender<GenerationTask>>>>> = 
    Lazy::new(|| Arc::new(Mutex::new(None)));

// Stop signal using watch channel for proper synchronization
static STOP_SIGNAL: Lazy<Arc<Mutex<Option<watch::Sender<bool>>>>> = 
    Lazy::new(|| Arc::new(Mutex::new(None)));

// Track pending temp files for cleanup on abort
static PENDING_TEMP_FILES: Lazy<Arc<Mutex<HashSet<String>>>> = 
    Lazy::new(|| Arc::new(Mutex::new(HashSet::new())));

#[derive(Debug)]
struct GenerationTask {
    text: String,
    voice: String,
    speed: f32,
    engine: String,
}

/// Initialize the audio player background task
/// Call this once at app startup
pub async fn init_audio_player() {
    let (tx, mut rx) = mpsc::channel::<GenerationTask>(64); // Increased buffer size
    let (stop_tx, mut stop_rx) = watch::channel(false);
    
    // Store the sender and stop signal
    {
        let mut queue = GENERATION_QUEUE.lock().await;
        *queue = Some(tx);
    }
    {
        let mut stop = STOP_SIGNAL.lock().await;
        *stop = Some(stop_tx);
    }
    
    // Spawn the generation + playback task
    // This processes tasks in order, generating and playing sequentially
    tokio::spawn(async move {
        loop {
            tokio::select! {
                // Check for stop signal
                _ = stop_rx.changed() => {
                    if *stop_rx.borrow() {
                        // Drain remaining tasks from queue when stopped
                        while rx.try_recv().is_ok() {}
                        // Wait for stop signal to be cleared
                        while *stop_rx.borrow() {
                            if stop_rx.changed().await.is_err() {
                                return; // Channel closed
                            }
                        }
                    }
                }
                // Process next task
                task = rx.recv() => {
                    let Some(task) = task else {
                        break; // Channel closed
                    };
                    
                    // Check stop signal before processing
                    if *stop_rx.borrow() {
                        continue;
                    }
                    
                    // Generate the audio based on engine
                    let audio_result = match task.engine.as_str() {
                        "piper" => generate_piper_audio(&task.text, &task.voice, task.speed).await,
                        "kokoro" => generate_kokoro_audio_fast(&task.text, &task.voice, task.speed).await,
                        _ => generate_kokoro_audio_fast(&task.text, &task.voice, task.speed).await,
                    };
                    
                    match audio_result {
                        Ok(file_path) => {
                            // Check stop signal again before playing
                            if *stop_rx.borrow() {
                                let _ = tokio::fs::remove_file(&file_path).await;
                                // Remove from pending temp files
                                let mut pending = PENDING_TEMP_FILES.lock().await;
                                pending.remove(&file_path);
                                continue;
                            }
                            
                            // Play the audio file using cancellable playback
                            if let Err(e) = play_audio_file_cancellable(&file_path, &mut stop_rx).await {
                                if e != "cancelled" {
                                    eprintln!("[TTS-RUST] Error playing audio: {}", e);
                                }
                            }
                            
                            // Clean up the temp file
                            let _ = tokio::fs::remove_file(&file_path).await;
                            // Remove from pending temp files
                            let mut pending = PENDING_TEMP_FILES.lock().await;
                            pending.remove(&file_path);
                        }
                        Err(e) => {
                            eprintln!("[TTS-RUST] Error generating audio: {}", e);
                        }
                    }
                }
            }
        }
    });
}

/// Play a single audio file with cancellation support (macOS only)
#[cfg(target_os = "macos")]
async fn play_audio_file_cancellable(file_path: &str, stop_rx: &mut watch::Receiver<bool>) -> Result<(), String> {
    let afplay = Command::new("afplay")
        .arg(file_path)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to play audio: {}", e))?;
    
    // Track the PID so we can kill only this process
    let pid = afplay.id();
    if let Some(pid) = pid {
        let mut pids = SPAWNED_PIDS.lock().await;
        pids.insert(pid);
    }
    
    // Store the process handle so it can be killed if needed
    {
        let mut process = CURRENT_PROCESS.lock().await;
        *process = Some(afplay);
    }
    
    // Wait for playback to complete or stop signal
    loop {
        // Check stop signal
        if *stop_rx.borrow() {
            // Kill the process
            let mut process = CURRENT_PROCESS.lock().await;
            if let Some(mut child) = process.take() {
                let _ = child.kill().await;
            }
            // Remove from tracked PIDs
            if let Some(pid) = pid {
                let mut pids = SPAWNED_PIDS.lock().await;
                pids.remove(&pid);
            }
            return Err("cancelled".to_string());
        }
        
        let mut process = CURRENT_PROCESS.lock().await;
        if let Some(ref mut child) = *process {
            match child.try_wait() {
                Ok(Some(_status)) => {
                    // Process finished
                    *process = None;
                    // Remove from tracked PIDs
                    if let Some(pid) = pid {
                        drop(process);
                        let mut pids = SPAWNED_PIDS.lock().await;
                        pids.remove(&pid);
                    }
                    break;
                }
                Ok(None) => {
                    // Still running, drop lock and sleep briefly
                    drop(process);
                    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
                }
                Err(_) => {
                    *process = None;
                    // Remove from tracked PIDs
                    if let Some(pid) = pid {
                        drop(process);
                        let mut pids = SPAWNED_PIDS.lock().await;
                        pids.remove(&pid);
                    }
                    break;
                }
            }
        } else {
            // Process was killed externally
            break;
        }
    }
    
    Ok(())
}

/// Platform stub for non-macOS systems
#[cfg(not(target_os = "macos"))]
async fn play_audio_file_cancellable(_file_path: &str, _stop_rx: &mut watch::Receiver<bool>) -> Result<(), String> {
    Err("Audio playback is only supported on macOS".to_string())
}

/// Queue a sentence for TTS generation and playback
/// Returns immediately - generation happens in order in background
pub async fn speak_sentence(text: &str, voice: &str, speed: f32, engine: &str) -> Result<(), String> {
    let task = GenerationTask {
        text: text.to_string(),
        voice: voice.to_string(),
        speed,
        engine: engine.to_string(),
    };
    
    // Queue the task - this returns immediately
    let queue = GENERATION_QUEUE.lock().await;
    if let Some(ref tx) = *queue {
        tx.send(task)
            .await
            .map_err(|e| format!("Failed to queue task: {}", e))?;
    } else {
        return Err("Audio player not initialized".to_string());
    }
    
    Ok(())
}

/// Generate audio file using Piper TTS, returns the file path
/// Fast local TTS - typically 0.5-1 second per sentence
async fn generate_piper_audio(text: &str, voice: &str, speed: f32) -> Result<String, String> {
    let temp_file = format!("/tmp/opencode-talk-piper-{}-{}.wav", 
        std::process::id(), 
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    );
    
    // Piper path
    let piper_path = dirs::home_dir()
        .map(|h| h.join("Library/Python/3.9/bin/piper"))
        .unwrap_or_else(|| std::path::PathBuf::from("piper"));
    
    // Default voice model path if not specified
    let model_path = if voice.ends_with(".onnx") {
        voice.to_string()
    } else {
        // Use the lessac-high voice by default (best quality)
        dirs::home_dir()
            .map(|h| h.join(".local/share/piper-voices/en_US-lessac-high.onnx"))
            .unwrap_or_else(|| std::path::PathBuf::from("en_US-lessac-high.onnx"))
            .to_string_lossy()
            .to_string()
    };
    
    // Generate audio with piper
    let mut piper_cmd = Command::new(&piper_path)
        .args([
            "--model", &model_path,
            "--output_file", &temp_file,
            "--length-scale", &(1.0 / speed).to_string(),
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start piper: {}", e))?;
    
    // Write text to piper's stdin
    if let Some(mut stdin) = piper_cmd.stdin.take() {
        use tokio::io::AsyncWriteExt;
        stdin.write_all(text.as_bytes()).await
            .map_err(|e| format!("Failed to write to piper: {}", e))?;
        drop(stdin); // Close stdin to signal EOF
    }
    
    // Wait for piper to finish
    let output = piper_cmd.wait_with_output().await
        .map_err(|e| format!("Failed to wait for piper: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Piper failed: {}", stderr));
    }
    
    Ok(temp_file)
}

/// Generate audio using Kokoro server (fast - model stays warm)
async fn generate_kokoro_audio_fast(text: &str, voice: &str, speed: f32) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    let response = client
        .post("http://127.0.0.1:7892/tts")
        .json(&serde_json::json!({
            "text": text,
            "voice": voice,
            "speed": speed
        }))
        .send()
        .await;
    
    // If Kokoro server fails, fall back to Piper
    let response = match response {
        Ok(r) if r.status().is_success() => r,
        Ok(r) => {
            eprintln!("Kokoro server returned {}, falling back to Piper", r.status());
            return generate_piper_audio(text, voice, speed).await;
        }
        Err(e) => {
            eprintln!("Kokoro server unavailable ({}), falling back to Piper", e);
            return generate_piper_audio(text, voice, speed).await;
        }
    };
    
    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Kokoro response: {}", e))?;
    
    let file_path = result["file"]
        .as_str()
        .ok_or("Missing file path in response")?
        .to_string();
    
    Ok(file_path)
}

/// Generate audio file using Kokoro TTS (slow - spawns new process)
/// Fallback if server is not running
#[allow(dead_code)]
async fn generate_kokoro_audio(text: &str, voice: &str, speed: f32) -> Result<String, String> {
    // Create a temp file for the audio output
    let temp_file = format!("/tmp/opencode-talk-sentence-{}-{}.wav", 
        std::process::id(), 
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    );
    
    // Python script to run Kokoro
    let python_script = format!(r#"
import sys
try:
    from kokoro import KPipeline
    import soundfile as sf
    
    pipeline = KPipeline(lang_code='a')
    text = sys.argv[1]
    voice = sys.argv[2]
    speed = float(sys.argv[3])
    output_file = sys.argv[4]
    
    generator = pipeline(text, voice=voice, speed=speed)
    
    # Concatenate all audio chunks
    all_audio = []
    for i, (gs, ps, audio) in enumerate(generator):
        all_audio.extend(audio)
    
    if all_audio:
        import numpy as np
        sf.write(output_file, np.array(all_audio), 24000)
        print("OK")
    else:
        print("No audio generated")
        sys.exit(1)
except ImportError as e:
    print(f"Kokoro not installed: {{e}}")
    sys.exit(1)
except Exception as e:
    print(f"Error: {{e}}")
    sys.exit(1)
"#);
    
    // Write script to temp file
    let script_file = format!("/tmp/opencode-talk-kokoro-{}-{}.py", 
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    );
    tokio::fs::write(&script_file, &python_script).await
        .map_err(|e| format!("Failed to write script: {}", e))?;
    
    // Run the Python script
    let output = Command::new("python3")
        .args([&script_file, text, voice, &speed.to_string(), &temp_file])
        .output()
        .await
        .map_err(|e| format!("Failed to run Kokoro: {}", e))?;
    
    // Clean up script file
    let _ = tokio::fs::remove_file(&script_file).await;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!("Kokoro failed: {} {}", stdout, stderr));
    }
    
    Ok(temp_file)
}

/// Clear the audio queue and stop current playback
pub async fn clear_audio_queue() -> Result<(), String> {
    // Set stop signal using watch channel
    {
        let stop = STOP_SIGNAL.lock().await;
        if let Some(ref tx) = *stop {
            let _ = tx.send(true);
        }
    }
    
    // Kill current playback
    stop_speaking().await?;
    
    // Clean up any pending temp files
    {
        let mut pending = PENDING_TEMP_FILES.lock().await;
        for file in pending.drain() {
            let _ = tokio::fs::remove_file(&file).await;
        }
    }
    
    // Reset stop signal after a short delay to allow queue to drain
    tokio::spawn(async {
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        let stop = STOP_SIGNAL.lock().await;
        if let Some(ref tx) = *stop {
            let _ = tx.send(false);
        }
    });
    
    Ok(())
}

/// Speak text using the specified TTS engine
pub async fn speak(text: &str, engine: &str, voice: &str, speed: f32) -> Result<(), String> {
    // Stop any currently playing audio first
    stop_speaking().await?;
    
    match engine {
        "macos" => speak_macos(text, voice, speed).await,
        "piper" => speak_piper(text, voice, speed).await,
        "kokoro" => speak_kokoro(text, voice, speed).await,
        "edge" => speak_edge(text, voice, speed).await,
        _ => Err(format!("Unknown TTS engine: {}", engine)),
    }
}

/// Stop any currently playing TTS
pub async fn stop_speaking() -> Result<(), String> {
    // Kill the current tracked process
    let mut process = CURRENT_PROCESS.lock().await;
    if let Some(mut child) = process.take() {
        let _ = child.kill().await;
    }
    drop(process);
    
    // Kill only our spawned processes by PID (not system-wide pkill)
    let pids_to_kill: Vec<u32> = {
        let pids = SPAWNED_PIDS.lock().await;
        pids.iter().copied().collect()
    };
    
    for pid in pids_to_kill {
        // Use kill command with specific PID
        let _ = Command::new("kill")
            .args(["-9", &pid.to_string()])
            .output()
            .await;
    }
    
    // Clear the PIDs set
    {
        let mut pids = SPAWNED_PIDS.lock().await;
        pids.clear();
    }
    
    Ok(())
}

/// Speak using macOS built-in `say` command
async fn speak_macos(text: &str, voice: &str, speed: f32) -> Result<(), String> {
    // Convert speed to words per minute (default is ~175 wpm)
    let rate = (175.0 * speed) as u32;
    
    let cmd = Command::new("say")
        .args(["-v", voice, "-r", &rate.to_string(), text])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start say command: {}", e))?;
    
    // Store the process handle so it can be killed if needed
    {
        let mut process = CURRENT_PROCESS.lock().await;
        *process = Some(cmd);
    }
    
    // Wait for process to complete
    let mut process = CURRENT_PROCESS.lock().await;
    if let Some(ref mut child) = *process {
        let _ = child.wait().await;
    }
    *process = None;
    
    Ok(())
}

/// Speak using Piper TTS
async fn speak_piper(text: &str, voice: &str, speed: f32) -> Result<(), String> {
    // Check if piper is installed
    let piper_check = Command::new("which")
        .arg("piper")
        .output()
        .await
        .map_err(|e| format!("Failed to check for piper: {}", e))?;
    
    if !piper_check.status.success() {
        return Err("Piper is not installed. Install with: pip install piper-tts".to_string());
    }
    
    // Create a temp file for the audio output
    let temp_file = format!("/tmp/opencode-talk-{}.wav", std::process::id());
    
    // Generate audio with piper
    let mut piper_output = Command::new("piper")
        .args([
            "--model", voice,
            "--output_file", &temp_file,
            "--length-scale", &(1.0 / speed).to_string(),
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start piper: {}", e))?;
    
    // Write text to piper's stdin
    if let Some(mut stdin) = piper_output.stdin.take() {
        use tokio::io::AsyncWriteExt;
        stdin.write_all(text.as_bytes()).await
            .map_err(|e| format!("Failed to write to piper: {}", e))?;
        drop(stdin); // Close stdin to signal EOF
    }
    
    // Wait for piper to finish
    let _ = piper_output.wait().await;
    
    // Play the generated audio
    let afplay = Command::new("afplay")
        .arg(&temp_file)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to play audio: {}", e))?;
    
    // Store the process handle
    {
        let mut process = CURRENT_PROCESS.lock().await;
        *process = Some(afplay);
    }
    
    // Wait for playback to complete
    let mut process = CURRENT_PROCESS.lock().await;
    if let Some(ref mut child) = *process {
        let _ = child.wait().await;
    }
    *process = None;
    
    // Clean up temp file
    let _ = tokio::fs::remove_file(&temp_file).await;
    
    Ok(())
}

/// Speak using Edge TTS (Microsoft neural voices)
async fn speak_edge(text: &str, voice: &str, speed: f32) -> Result<(), String> {
    // Create a temp file for the audio output
    let temp_file = format!("/tmp/opencode-talk-{}.mp3", std::process::id());
    
    // edge-tts path (installed via pip)
    let edge_tts_path = dirs::home_dir()
        .map(|h| h.join("Library/Python/3.9/bin/edge-tts"))
        .unwrap_or_else(|| std::path::PathBuf::from("edge-tts"));
    
    // Calculate rate adjustment (edge-tts uses percentage like +10% or -10%)
    let rate_percent = ((speed - 1.0) * 100.0) as i32;
    let rate_str = if rate_percent >= 0 {
        format!("+{}%", rate_percent)
    } else {
        format!("{}%", rate_percent)
    };
    
    // Generate audio with edge-tts
    let output = Command::new(&edge_tts_path)
        .args([
            "--text", text,
            "--voice", voice,
            "--rate", &rate_str,
            "--write-media", &temp_file,
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .await
        .map_err(|e| format!("Failed to run edge-tts: {}", e))?;
    
    if !output.status.success() {
        return Err("edge-tts failed to generate audio".to_string());
    }
    
    // Play the generated audio
    let afplay = Command::new("afplay")
        .arg(&temp_file)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to play audio: {}", e))?;
    
    // Store the process handle
    {
        let mut process = CURRENT_PROCESS.lock().await;
        *process = Some(afplay);
    }
    
    // Wait for playback to complete
    let mut process = CURRENT_PROCESS.lock().await;
    if let Some(ref mut child) = *process {
        let _ = child.wait().await;
    }
    *process = None;
    
    // Clean up temp file
    let _ = tokio::fs::remove_file(&temp_file).await;
    
    Ok(())
}

/// Speak using Kokoro TTS (via Python)
async fn speak_kokoro(text: &str, voice: &str, speed: f32) -> Result<(), String> {
    // Create a temp file for the audio output
    let temp_file = format!("/tmp/opencode-talk-{}.wav", std::process::id());
    
    // Python script to run Kokoro
    let python_script = format!(r#"
import sys
try:
    from kokoro import KPipeline
    import soundfile as sf
    
    pipeline = KPipeline(lang_code='a')
    text = sys.argv[1]
    voice = sys.argv[2]
    speed = float(sys.argv[3])
    output_file = sys.argv[4]
    
    generator = pipeline(text, voice=voice, speed=speed)
    
    # Concatenate all audio chunks
    all_audio = []
    for i, (gs, ps, audio) in enumerate(generator):
        all_audio.extend(audio)
    
    if all_audio:
        import numpy as np
        sf.write(output_file, np.array(all_audio), 24000)
        print("OK")
    else:
        print("No audio generated")
        sys.exit(1)
except ImportError as e:
    print(f"Kokoro not installed: {{e}}")
    sys.exit(1)
except Exception as e:
    print(f"Error: {{e}}")
    sys.exit(1)
"#);
    
    // Write script to temp file
    let script_file = format!("/tmp/opencode-talk-kokoro-{}.py", std::process::id());
    tokio::fs::write(&script_file, &python_script).await
        .map_err(|e| format!("Failed to write script: {}", e))?;
    
    // Run the Python script
    let output = Command::new("python3")
        .args([&script_file, text, voice, &speed.to_string(), &temp_file])
        .output()
        .await
        .map_err(|e| format!("Failed to run Kokoro: {}", e))?;
    
    // Clean up script file
    let _ = tokio::fs::remove_file(&script_file).await;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!("Kokoro failed: {} {}", stdout, stderr));
    }
    
    // Play the generated audio
    let afplay = Command::new("afplay")
        .arg(&temp_file)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to play audio: {}", e))?;
    
    // Store the process handle
    {
        let mut process = CURRENT_PROCESS.lock().await;
        *process = Some(afplay);
    }
    
    // Wait for playback to complete
    let mut process = CURRENT_PROCESS.lock().await;
    if let Some(ref mut child) = *process {
        let _ = child.wait().await;
    }
    *process = None;
    
    // Clean up temp file
    let _ = tokio::fs::remove_file(&temp_file).await;
    
    Ok(())
}
