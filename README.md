# OpenCode Talk

A voice interface for [OpenCode](https://opencode.ai) - talk to your codebase naturally.

## Why OpenCode Talk?

**Voice is the most natural interface.** When you're thinking through a problem, explaining what you need, or reviewing code, speaking is often faster and more natural than typing. OpenCode Talk brings that experience to AI-assisted coding.

**Key motivations:**

- **Hands-free interaction** - Talk to your codebase while sketching on paper, pacing, or keeping your hands on the keyboard for other work
- **Lower friction** - Speak your intent naturally instead of crafting the perfect prompt
- **Real-time conversation** - Streaming text and voice creates a natural back-and-forth dialogue, not a "submit and wait" experience
- **Privacy by default** - Local TTS means your code conversations never leave your machine
- **High-quality voice** - Natural-sounding speech that you actually want to listen to, not robotic text-to-speech

## Features

- **Voice Input**: Speak naturally using SuperWhisper or macOS dictation
- **Voice Output**: High-quality TTS with Kokoro, Piper, or macOS voices
- **Smart Responses**: Responses formatted for speech (code summarized, not read aloud)
- **Streaming**: See and hear responses as they generate in real-time
- **Confirmation System**: Dangerous actions require voice or click confirmation
- **Continuous Conversation**: Natural back-and-forth dialogue
- **Interruption Support**: Stop responses mid-speech with a hotkey

## Prerequisites

- **macOS 13+** (Ventura or later)
- **Node.js 18+**
- **Rust** (install via [rustup](https://rustup.rs))
- **OpenCode** running (`opencode serve`) - [opencode.ai](https://opencode.ai)
- **SuperWhisper** (recommended) or macOS Dictation - [superwhisper.com](https://superwhisper.com)

## Installation

### From Source

```bash
# Clone the repo
git clone https://github.com/dcartertwo/opencode-talk.git
cd opencode-talk

# Install dependencies
npm install

# Build the app
npm run tauri build
```

The built app will be at `src-tauri/target/release/bundle/macos/OpenCode Talk.app`.

## Quick Start

1. **Start OpenCode** in your project directory:
   ```bash
   cd your-project
   opencode serve
   ```

2. **Launch OpenCode Talk** from your Applications folder or run:
   ```bash
   npm run tauri dev
   ```

3. **Configure voice input** (Settings → Voice Input):
   - Install SuperWhisper from [superwhisper.com](https://superwhisper.com)
   - Click "Auto-Configure" to set up Macrowhisper integration

4. **Start talking!** Press `⌥Space` (Option+Space) to speak.

## Hotkeys

| Action | Default Hotkey |
|--------|---------------|
| Push-to-Talk | `⌥Space` |
| Continuous Mode | `⌥⇧Space` |
| Interrupt/Stop | `Escape` |

Customize hotkeys in Settings → Voice Input.

## Voice Commands

- **"New conversation"** - Start fresh
- **"Switch to [project]"** - Change active project
- **"Yes" / "No"** - Respond to confirmations

## TTS Engines

OpenCode Talk supports multiple TTS engines with various voice models. Kokoro is the default for its excellent quality and local privacy.

| Engine | Quality | Speed | Privacy | Notes |
|--------|---------|-------|---------|-------|
| **Kokoro** (default) | ★★★★★ | ~0.3s/sentence | 100% local | ~5s model load on first launch |
| **Piper** | ★★★★☆ | ~0.2s/sentence | 100% local | Fallback if Kokoro unavailable |
| **macOS** | ★★☆☆☆ | Instant | 100% local | Built-in, always available |

Multiple voice models are supported within each engine. Additional engines (including cloud options like [MiniMax](https://replicate.com/blog/minimax-text-to-speech)) are planned for future releases.

### Installing Kokoro (Recommended)

```bash
pip install kokoro soundfile numpy
brew install espeak-ng  # Required for phoneme processing
```

### Installing Piper

```bash
pip install piper-tts
```

Piper voices are downloaded automatically on first use, or manually to `~/.local/share/piper-voices/`.

## Configuration

Settings are stored in `~/.config/opencode-talk/settings.json`.

### SuperWhisper + Macrowhisper Setup

1. Install SuperWhisper from [superwhisper.com](https://superwhisper.com)

2. Install Macrowhisper:
   ```bash
   brew install ognistik/formulae/macrowhisper
   ```

3. Configure SuperWhisper:
   - Turn **OFF**: "Paste Result Text"
   - Turn **OFF**: "Restore Clipboard After Paste"
   - Turn **OFF**: "Simulate Key Presses"
   - Keep **ON**: "Recording Window"

4. Start Macrowhisper:
   ```bash
   macrowhisper --start-service
   ```

5. In OpenCode Talk Settings, click "Auto-Configure" or manually edit `~/.config/macrowhisper/macrowhisper.json`

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build

# Type check
npm run build
```

### Project Structure

```
opencode-talk/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # React hooks
│   ├── lib/                # Core logic
│   │   ├── voice-bridge.ts # Main integration
│   │   ├── sentence-buffer.ts
│   │   └── ...
│   └── stores/            # Zustand stores
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── lib.rs         # Main Tauri app
│   │   ├── tts.rs         # TTS implementation
│   │   └── transcription_server.rs
│   └── scripts/
│       └── kokoro_server.py  # Persistent TTS server
└��─ ...
```

See [AGENTS.md](./AGENTS.md) for detailed architecture documentation.

## Troubleshooting

### "Not connected to OpenCode"

Make sure OpenCode is running:
```bash
opencode serve
```

Check the server URL in Settings → OpenCode (default: `http://localhost:4096`).

### Voice not recognized

1. Check SuperWhisper is running and configured correctly
2. Verify Macrowhisper service is active: `macrowhisper --service-status`
3. Try the macOS dictation fallback in Settings

### TTS not working

1. For Kokoro: Ensure Python 3 and the `kokoro` package are installed
2. For Piper: Ensure `piper-tts` is installed
3. macOS `say` should always work as fallback

### Hotkeys not working

Grant Accessibility permissions:
1. System Settings → Privacy & Security → Accessibility
2. Add OpenCode Talk to the list

## Roadmap

- [ ] Additional TTS engines ([MiniMax](https://replicate.com/blog/minimax-text-to-speech), ElevenLabs)
- [ ] More voice model options per engine
- [ ] Cross-platform support (Windows, Linux)
- [ ] Improved conversation context handling

## Known Issues

- **First launch delay**: Kokoro model takes ~5 seconds to load on first launch. Subsequent TTS requests are fast (~0.3s per sentence).
- **Recording after long idle**: If the app has been idle for a long time, the first recording may not trigger. Restart the app if this occurs.
- **SSE connection**: The connection to OpenCode's event stream is re-established per message, which may cause brief delays.

## License

MIT

## Credits

- [OpenCode](https://opencode.ai) - AI coding agent
- [SuperWhisper](https://superwhisper.com) - Voice-to-text
- [Macrowhisper](https://github.com/ognistik/macrowhisper) - SuperWhisper automation
- [Kokoro](https://github.com/hexgrad/kokoro) - High-quality TTS
- [Piper](https://github.com/OHF-Voice/piper1-gpl) - Fast local TTS
- [Tauri](https://tauri.app) - App framework
