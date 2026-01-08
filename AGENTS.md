# AGENTS.md

This document helps AI agents understand and contribute to the OpenCode Talk codebase.

## Project Overview

**OpenCode Talk** is a macOS desktop app that provides a voice interface for [OpenCode](https://opencode.ai). Users speak naturally, the app sends requests to OpenCode, and responses stream back as both text and speech.

### Why Voice?

- **Hands-free interaction** - Talk while sketching, pacing, or keeping hands on the keyboard
- **Lower friction** - Speak intent naturally instead of crafting prompts
- **Real-time conversation** - Streaming text + voice creates natural dialogue
- **Privacy by default** - Local TTS keeps code conversations on your machine
- **High-quality voice** - Natural speech you want to listen to

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Tauri 2 (Rust backend + React frontend) |
| **Frontend** | React 19, TypeScript, Zustand, Tailwind CSS 4 |
| **Backend** | Rust (async with Tokio) |
| **TTS** | Kokoro (primary), Piper (fallback), macOS `say` (fallback) |
| **STT** | SuperWhisper + Macrowhisper |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         OpenCode Talk                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   React Frontend                         │    │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐   │    │
│  │  │ voice-      │  │ sentence-    │  │ stores/       │   │    │
│  │  │ bridge.ts   │  │ buffer.ts    │  │ *.ts          │   │    │
│  │  └──────┬──────┘  └──────┬───────┘  └───────────────┘   │    │
│  └─────────┼────────────────┼──────────────────────────────┘    │
│            │                │                                    │
│            │ invoke()       │                                    │
│            ▼                ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Tauri Rust                            │    │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐   │    │
│  │  │ lib.rs      │  │ tts.rs       │  │ transcription │   │    │
│  │  │ (commands)  │  │ (audio)      │  │ _server.rs    │   │    │
│  │  └─────────────┘  └──────┬───────┘  └───────┬───────┘   │    │
│  └──────────────────────────┼──────────────────┼───────────┘    │
│                             │                  │                 │
└─────────────────────────────┼──────────────────┼─────────────────┘
                              │                  │
                              ▼                  ▼
                    ┌──────────────┐    ┌───────────────┐
                    │ Kokoro       │    │ Macrowhisper  │
                    │ Server :7892 │    │ POST :7891    │
                    └──────────────┘    └───────┬───────┘
                                                │
                                                ▼
                                       ┌───────────────┐
                                       │ SuperWhisper  │
                                       │ (system-wide) │
                                       └───────────────┘

External:
┌─────────────────┐
│ OpenCode Server │ ◄── SSE streaming ──► voice-bridge.ts
│ :4096           │
└─────────────────┘
```

### Voice Input Flow

```
SuperWhisper (system-wide STT)
    │
    ▼ (sends transcription via Macrowhisper)
Macrowhisper
    │
    ▼ HTTP POST :7891
transcription_server.rs
    │
    ▼ Tauri event
voice-bridge.ts → processVoiceInput()
    │
    ▼
sendMessage() → OpenCode
```

### Voice Output Flow

```
OpenCode Server
    │
    ▼ SSE (Server-Sent Events)
voice-bridge.ts (sendMessageStreaming)
    │
    ▼ text deltas
sentence-buffer.ts
    │
    ▼ complete sentences
invoke('speak_sentence')
    │
    ▼ Rust tts.rs
Kokoro server :7892 (or Piper fallback)
    │
    ▼ audio file
afplay (macOS audio)
```

### Kokoro Server (Subcomponent)

The Kokoro TTS server keeps the model loaded in memory for fast responses.

| Property | Value |
|----------|-------|
| **Location** | `src-tauri/scripts/kokoro_server.py` |
| **Port** | 7892 |
| **Cold start** | ~5 seconds (model loading) |
| **Warm response** | ~0.3 seconds per sentence |
| **API** | `POST /tts` (JSON: text, voice, speed) |
| **Health** | `GET /health` |
| **Fallback** | Piper TTS if server unavailable |

Started automatically by `lib.rs` on app launch.

## Key Files Reference

### Frontend (`src/`)

| File | Purpose |
|------|---------|
| `lib/voice-bridge.ts` | Main integration - SSE streaming, sendMessage(), connects to OpenCode |
| `lib/sentence-buffer.ts` | Buffers streaming text, emits complete sentences for TTS |
| `lib/response-formatter.ts` | Formats OpenCode responses for speech |
| `lib/confirmation.ts` | Handles confirmation dialogs for dangerous actions |
| `stores/conversation.ts` | Messages, streaming state, voice state (Zustand) |
| `stores/settings.ts` | TTS engine, voice, speed, server URL (persisted) |

### Backend (`src-tauri/`)

| File | Purpose |
|------|---------|
| `src/lib.rs` | Tauri setup, command registration, Kokoro server startup |
| `src/tts.rs` | TTS implementation - audio queue, Kokoro/Piper/macOS engines |
| `src/transcription_server.rs` | HTTP server receiving Macrowhisper transcriptions |
| `scripts/kokoro_server.py` | Persistent Python server keeping Kokoro model warm |

## State Management

### conversation.ts

```typescript
interface ConversationStore {
  sessionId: string | null;          // OpenCode session
  projectPath: string | null;        // Current project directory
  voiceState: VoiceState;            // 'idle' | 'listening' | 'processing' | 'speaking'
  messages: Message[];               // Conversation history (last 10)
  streamingText: string;             // Current streaming response
  isStreaming: boolean;              // Whether response is streaming
  pendingConfirmation: PendingConfirmation | null;
  isConnected: boolean;
  connectionError: string | null;
}
```

### settings.ts

```typescript
interface Settings {
  ttsEngine: 'kokoro' | 'piper' | 'macos' | 'edge';
  ttsVoice: string;                  // e.g., 'af_heart' for Kokoro
  ttsSpeed: number;                  // e.g., 1.2
  serverUrl: string;                 // e.g., 'http://localhost:4096'
  model: string;                     // e.g., 'anthropic/claude-sonnet-4-20250514'
  // ... confirmation settings, UI settings
}
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode (hot reload)
npm run tauri dev

# Build for production
npm run tauri build

# Type check
npm run build
```

### Ports Used

| Port | Service |
|------|---------|
| 4096 | OpenCode server |
| 7891 | Transcription server (receives Macrowhisper) |
| 7892 | Kokoro TTS server |

## Design Decisions

### Why Kokoro with a Warm Server?

Cold Kokoro startup takes ~5-7 seconds (loading the ML model). By keeping a Python server running with the model pre-loaded, we achieve ~0.3s per sentence - fast enough for real-time streaming TTS.

### Why Sentence Buffering?

TTS sounds unnatural with partial words or incomplete phrases. The `SentenceBuffer` class accumulates streaming text and emits complete sentences, handling:
- Abbreviations (Dr., Mr., etc.)
- List numbers (1., 2.)
- Minimum sentence length (avoids choppy single-word output)

### Why SSE for Streaming?

OpenCode exposes an SSE endpoint (`/event`) that streams response deltas. This allows:
- Real-time text display as the model generates
- Immediate TTS queuing for each sentence
- Responsive interruption (close the EventSource)

### Why Piper Fallback?

Kokoro provides the best quality but requires Python + model. Piper is a lighter fallback that still sounds good. macOS `say` is always available as a last resort.

## Extension Points

### Adding a New TTS Engine

1. **Add engine type** in `src/stores/settings.ts`:
   ```typescript
   ttsEngine: 'kokoro' | 'piper' | 'macos' | 'your-engine';
   ```

2. **Implement in Rust** (`src-tauri/src/tts.rs`):
   ```rust
   async fn speak_your_engine(text: &str, voice: &str, speed: f32) -> Result<(), String> {
       // Generate audio file
       // Play with afplay
   }
   ```

3. **Add to engine match** in `speak()` and `generate_*_audio()` functions

4. **Update UI** to show the new engine option in settings

### Adding a New Voice Model

For Kokoro, voices are specified by name (e.g., `af_heart`, `am_michael`). To add a new voice:

1. Ensure the voice is available in Kokoro's model
2. Add to voice selector in settings UI
3. The voice name is passed directly to the Kokoro server

### Adding a New STT Engine

1. Implement a transcription receiver in `src-tauri/src/transcription_server.rs`
2. Emit Tauri events with the transcription text
3. Handle in `voice-bridge.ts` similar to Macrowhisper

## Future Plans

- **MiniMax TTS** - Cloud TTS option with excellent voice quality ([replicate.com/blog/minimax-text-to-speech](https://replicate.com/blog/minimax-text-to-speech))
- **Additional voice models** - More Kokoro voices, custom voice training
- **Cross-platform** - Windows and Linux support
- **Interruption during generation** - Currently can only interrupt playback, not the SSE stream

## Known Issues

1. **First launch delay** - Kokoro model takes ~5s to load on first TTS request
2. **Recording after long idle** - May not trigger; restart app if this occurs
3. **SSE reconnection** - Connection re-established per message (brief delay)
4. **Cannot interrupt during generation** - Only playback can be stopped, not the OpenCode response stream

## Testing Changes

Manual testing workflow:

1. Start OpenCode: `opencode serve`
2. Run the app: `npm run tauri dev`
3. Test voice input: Press Option+Space, speak, verify transcription
4. Test TTS: Send a message, verify audio plays
5. Test streaming: Watch text appear in real-time during response
6. Test interruption: Press Escape during playback

## Code Style

- **TypeScript**: Follow existing patterns, use Zustand for state
- **Rust**: Run `cargo fmt` before committing
- **Commits**: Conventional commits preferred (`feat:`, `fix:`, `docs:`)
