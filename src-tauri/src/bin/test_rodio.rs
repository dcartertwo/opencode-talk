//! Test program to verify rodio zero-gap playback
//! 
//! This compares afplay (subprocess) vs rodio (native) for playing
//! multiple WAV files back-to-back, measuring the gaps between them.
//! 
//! Run with: cargo run --bin test_rodio -- <wav1> <wav2> <wav3>

use rodio::{Decoder, OutputStream, Sink, Source};
use std::env;
use std::fs::File;
use std::io::BufReader;
use std::process::Command;
use std::time::{Duration, Instant};

fn get_audio_duration(path: &str) -> Option<Duration> {
    let file = File::open(path).ok()?;
    let source = Decoder::new(BufReader::new(file)).ok()?;
    source.total_duration()
}

fn test_afplay(files: &[String]) -> Duration {
    println!("\n=== Testing afplay (baseline) ===");
    let total_start = Instant::now();
    
    for (i, f) in files.iter().enumerate() {
        let file_start = Instant::now();
        let status = Command::new("afplay")
            .arg(f)
            .status()
            .expect("Failed to run afplay");
        
        if !status.success() {
            eprintln!("  afplay failed for {}", f);
        }
        println!("  File {}: {:?}", i + 1, file_start.elapsed());
    }
    
    let total = total_start.elapsed();
    println!("afplay total: {:?}", total);
    total
}

fn test_rodio_per_file(files: &[String]) -> Duration {
    println!("\n=== Testing rodio (new sink per file) ===");
    let total_start = Instant::now();
    
    for (i, f) in files.iter().enumerate() {
        let file_start = Instant::now();
        
        // Create new output stream for each file (worst case)
        let (_stream, handle) = OutputStream::try_default()
            .expect("Failed to create output stream");
        let sink = Sink::try_new(&handle)
            .expect("Failed to create sink");
        
        let file = File::open(f).expect("Failed to open file");
        let source = Decoder::new(BufReader::new(file))
            .expect("Failed to decode audio");
        
        sink.append(source);
        sink.sleep_until_end();
        
        println!("  File {}: {:?}", i + 1, file_start.elapsed());
    }
    
    let total = total_start.elapsed();
    println!("rodio (per-file sink) total: {:?}", total);
    total
}

fn test_rodio_queued(files: &[String]) -> Duration {
    println!("\n=== Testing rodio (persistent sink, queued) ===");
    
    // Create output stream ONCE
    let (_stream, handle) = OutputStream::try_default()
        .expect("Failed to create output stream");
    let sink = Sink::try_new(&handle)
        .expect("Failed to create sink");
    
    let total_start = Instant::now();
    
    // Append all files to the queue
    for (i, f) in files.iter().enumerate() {
        let file = File::open(f).expect("Failed to open file");
        let source = Decoder::new(BufReader::new(file))
            .expect("Failed to decode audio");
        
        sink.append(source);
        println!("  Appended file {} at {:?}", i + 1, total_start.elapsed());
    }
    
    // Wait for all playback to complete
    sink.sleep_until_end();
    
    let total = total_start.elapsed();
    println!("rodio (queued) total: {:?}", total);
    total
}

fn main() {
    let args: Vec<String> = env::args().collect();
    
    if args.len() < 2 {
        eprintln!("Usage: {} <wav1> [wav2] [wav3] ...", args[0]);
        eprintln!("\nYou can generate test files with Kokoro:");
        eprintln!("  curl -X POST http://127.0.0.1:7892/tts -H 'Content-Type: application/json' \\");
        eprintln!("    -d '{{\"text\": \"This is test sentence one.\", \"voice\": \"af_heart\", \"speed\": 1.2}}'");
        std::process::exit(1);
    }
    
    let files: Vec<String> = args[1..].to_vec();
    
    // Print file info
    println!("=== Audio file info ===");
    let mut total_audio_duration = Duration::ZERO;
    for f in &files {
        match get_audio_duration(f) {
            Some(d) => {
                println!("  {}: {:?}", f, d);
                total_audio_duration += d;
            }
            None => println!("  {}: (duration unknown)", f),
        }
    }
    println!("Expected total audio duration: {:?}", total_audio_duration);
    
    // Run tests
    let afplay_time = test_afplay(&files);
    
    // Small pause between tests
    std::thread::sleep(Duration::from_millis(500));
    
    let rodio_per_file_time = test_rodio_per_file(&files);
    
    std::thread::sleep(Duration::from_millis(500));
    
    let rodio_queued_time = test_rodio_queued(&files);
    
    // Summary
    println!("\n=== SUMMARY ===");
    println!("Expected audio duration: {:?}", total_audio_duration);
    println!("afplay total:            {:?} (overhead: {:?})", 
             afplay_time, 
             afplay_time.saturating_sub(total_audio_duration));
    println!("rodio per-file total:    {:?} (overhead: {:?})", 
             rodio_per_file_time,
             rodio_per_file_time.saturating_sub(total_audio_duration));
    println!("rodio queued total:      {:?} (overhead: {:?})", 
             rodio_queued_time,
             rodio_queued_time.saturating_sub(total_audio_duration));
    
    // Verdict
    println!("\n=== VERDICT ===");
    if rodio_queued_time < afplay_time {
        let improvement = afplay_time.saturating_sub(rodio_queued_time);
        println!("SUCCESS: rodio queued is {:?} faster than afplay!", improvement);
        
        let queued_overhead = rodio_queued_time.saturating_sub(total_audio_duration);
        if queued_overhead < Duration::from_millis(500) {
            println!("EXCELLENT: rodio queued has minimal overhead ({:?})", queued_overhead);
        } else {
            println!("WARNING: rodio queued still has notable overhead ({:?})", queued_overhead);
        }
    } else {
        println!("FAILURE: rodio queued is NOT faster than afplay");
        println!("Need to investigate alternative approaches");
    }
}
