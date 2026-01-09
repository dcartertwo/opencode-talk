/**
 * Local HTTP server to receive transcriptions from Macrowhisper
 * 
 * Macrowhisper is configured to POST transcriptions to http://localhost:7891/transcription
 * We receive the text and emit it as a Tauri event to the frontend.
 */

use std::thread;
use tauri::{AppHandle, Emitter};
use tiny_http::{Server, Response, Method, Header};
use serde::{Deserialize, Serialize};

const SERVER_PORT: u16 = 7891;

#[derive(Debug, Serialize, Deserialize)]
pub struct TranscriptionPayload {
    pub text: String,
    #[serde(default)]
    pub confidence: Option<f32>,
}

/// Start the local HTTP server to receive transcriptions
pub fn start_server(app_handle: AppHandle) {
    thread::spawn(move || {
        let server = match Server::http(format!("127.0.0.1:{}", SERVER_PORT)) {
            Ok(s) => {
                println!("Transcription server started on port {}", SERVER_PORT);
                s
            }
            Err(e) => {
                eprintln!("Failed to start transcription server: {}", e);
                return;
            }
        };

        for mut request in server.incoming_requests() {
            let app = app_handle.clone();
            
            // Only accept POST to /transcription
            if request.method() != &Method::Post {
                let response = Response::from_string("Method not allowed")
                    .with_status_code(405);
                let _ = request.respond(response);
                continue;
            }

            let url = request.url().to_string();
            if url != "/transcription" && url != "/transcription/" {
                let response = Response::from_string("Not found")
                    .with_status_code(404);
                let _ = request.respond(response);
                continue;
            }

            // Read the body
            let mut body = String::new();
            if let Err(e) = request.as_reader().read_to_string(&mut body) {
                eprintln!("Failed to read request body: {}", e);
                let response = Response::from_string("Failed to read body")
                    .with_status_code(400);
                let _ = request.respond(response);
                continue;
            }

            // Try to parse as JSON first, otherwise treat as plain text
            let text = if body.trim().starts_with('{') {
                match serde_json::from_str::<TranscriptionPayload>(&body) {
                    Ok(payload) => payload.text,
                    Err(_) => body.trim().to_string(),
                }
            } else {
                body.trim().to_string()
            };

            if text.is_empty() {
                let response = Response::from_string("Empty transcription")
                    .with_status_code(400);
                let _ = request.respond(response);
                continue;
            }

            println!("Received transcription: {}", text);

            // Emit the transcription event to the frontend
            let payload = TranscriptionPayload {
                text: text.clone(),
                confidence: None,
            };
            
            if let Err(e) = app.emit("transcription", &payload) {
                eprintln!("Failed to emit transcription event: {}", e);
            }

            // Respond with success
            let response = Response::from_string("OK")
                .with_status_code(200)
                .with_header(
                    Header::from_bytes(&b"Content-Type"[..], &b"text/plain"[..]).unwrap()
                );
            let _ = request.respond(response);
        }
    });
}

/// Get the transcription server URL for configuring Macrowhisper
#[allow(dead_code)]
pub fn get_server_url() -> String {
    format!("http://127.0.0.1:{}/transcription", SERVER_PORT)
}
