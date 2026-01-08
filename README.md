# OpenCode Talk

A voice interface for [OpenCode](https://opencode.ai) - talk to your codebase naturally.

## Features

- **Voice Input**: Speak naturally using SuperWhisper or macOS dictation
- **Voice Output**: High-quality TTS with Kokoro, Piper, or macOS voices
- **Smart Responses**: Responses formatted for speech (code summarized, not read aloud)
- **Confirmation System**: Dangerous actions require voice or click confirmation
- **Continuous Conversation**: Natural back-and-forth dialogue
- **Interruption Support**: Stop responses mid-speech with a hotkey

## Requirements

- macOS 13+ (Ventura or later)
- [OpenCode](https://opencode.ai) running (`opencode serve`)
- [SuperWhisper](https://superwhisper.com) (recommended) or macOS Dictation

## Installation

### From DMG (Recommended)

Download the latest release from [Releases](https://github.com/opencode/opencode-talk/releases).

### From Source

```bash
# Clone the repo
git clone https://github.com/opencode/opencode-talk.git
cd opencode-talk

# Install dependencies
npm install

# Build the app
npm run tauri build
```

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

| Engine | Quality | Speed | Privacy |
|--------|---------|-------|---------|
| **Kokoro** | ★★★★★ | Real-time | 100% local |
| **Piper** | ★★★★☆ | Very fast | 100% local |
| **macOS** | ★★☆☆☆ | Instant | 100% local |
| **OpenAI** | ★★★★★ | ~500ms | Cloud |

### Installing Kokoro (Recommended)

```bash
pip install kokoro soundfile
brew install espeak-ng
```

### Installing Piper

```bash
pip install piper-tts
```

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
│   │   ├── tts/           # Text-to-speech
│   │   ├── stt/           # Speech-to-text
│   │   ├── voice-bridge.ts # Main integration
│   │   └── ...
│   └── stores/            # Zustand stores
├── src-tauri/             # Rust backend
│   └── src/
│       ├── lib.rs         # Main Tauri app
│       ├── tts.rs         # TTS implementation
│       └── audio.rs       # Audio playback
└── ...
```

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

## License

MIT

## Credits

- [OpenCode](https://opencode.ai) - AI coding agent
- [SuperWhisper](https://superwhisper.com) - Voice-to-text
- [Macrowhisper](https://github.com/ognistik/macrowhisper) - SuperWhisper automation
- [Kokoro](https://github.com/hexgrad/kokoro) - High-quality TTS
- [Piper](https://github.com/OHF-Voice/piper1-gpl) - Fast local TTS
- [Tauri](https://tauri.app) - App framework
