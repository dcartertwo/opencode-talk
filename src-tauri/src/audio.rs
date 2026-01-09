use tokio::process::Command;
use std::process::Stdio;

/// Handle to track audio playback
pub struct AudioHandle {
    // Reserved for future use with rodio or other audio libraries
}

/// Play a macOS system sound
pub async fn play_system_sound(sound_name: &str) -> Result<(), String> {
    // macOS system sounds are located in /System/Library/Sounds/
    let sound_path = format!("/System/Library/Sounds/{}.aiff", sound_name);
    
    // Check if the sound file exists
    if !std::path::Path::new(&sound_path).exists() {
        // Try alternative locations
        let alt_path = format!("/System/Library/Sounds/{}.wav", sound_name);
        if std::path::Path::new(&alt_path).exists() {
            return play_audio_file(&alt_path).await;
        }
        
        // If not found, try playing with afplay anyway (might be a built-in sound)
        return play_audio_file(&sound_path).await;
    }
    
    play_audio_file(&sound_path).await
}

/// Play an audio file using afplay
pub async fn play_audio_file(path: &str) -> Result<(), String> {
    let output = Command::new("afplay")
        .arg(path)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .await
        .map_err(|e| format!("Failed to play audio: {}", e))?;
    
    if !output.status.success() {
        return Err("Audio playback failed".to_string());
    }
    
    Ok(())
}

/// List available macOS voices
#[allow(dead_code)]
pub async fn list_macos_voices() -> Result<Vec<String>, String> {
    let output = Command::new("say")
        .args(["-v", "?"])
        .output()
        .await
        .map_err(|e| format!("Failed to list voices: {}", e))?;
    
    if !output.status.success() {
        return Err("Failed to list voices".to_string());
    }
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let voices: Vec<String> = stdout
        .lines()
        .filter_map(|line| {
            // Format: "Voice Name    en_US    # comment"
            line.split_whitespace().next().map(|s| s.to_string())
        })
        .collect();
    
    Ok(voices)
}
