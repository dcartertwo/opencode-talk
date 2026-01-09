# OpenCode Talk

A voice interface for [OpenCode](https://opencode.ai) - talk to your codebase naturally.

> **Status:** Active development. Core functionality works but expect rough edges. See [Known Issues](#known-issues) below.

## Installation

### Prerequisites

You need these installed first:

| Requirement | Check if installed | Install |
|-------------|-------------------|---------|
| **Homebrew** | `brew --version` | [brew.sh](https://brew.sh) |
| **Node.js 18+** | `node --version` | `brew install node` |
| **Rust** | `rustc --version` | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **OpenCode** | `opencode --version` | `npm install -g opencode` or see [opencode.ai](https://opencode.ai) |

### Build & Run

```bash
# Clone and build
git clone https://github.com/dcartertwo/opencode-talk.git
cd opencode-talk
npm install
npm run tauri build

# The app is now at:
# src-tauri/target/release/bundle/macos/OpenCode Talk.app
#
# Drag it to /Applications or run directly:
open "src-tauri/target/release/bundle/macos/OpenCode Talk.app"
```

**Build failing?** See [Troubleshooting](#build-issues) below.

---

## Setup

### Step 1: Start OpenCode (Required)

In a terminal, navigate to your project and start the OpenCode server:

```bash
cd ~/your-project
opencode serve
```

Keep this terminal open. OpenCode Talk connects to this server.

### Step 2: Launch OpenCode Talk

Open the app. You should see "Connected" in the status bar. If not, check that OpenCode is running.

### Step 3: Configure Voice Output

**Choose one option:**

#### Option A: macOS Say (Zero Setup - Works Immediately)

1. Open Settings (gear icon)
2. Set **TTS Engine** to `macos`
3. Done! Test by sending a message.

This uses the built-in macOS `say` command. Quality is basic but it works out of the box.

#### Option B: Kokoro (Best Quality - Recommended)

Kokoro provides natural, high-quality voices but requires Python setup.

```bash
# Install Python dependencies
pip3 install kokoro soundfile numpy

# Install phoneme processor (required by Kokoro)
brew install espeak-ng

# Verify installation
python3 -c "from kokoro import KPipeline; print('Kokoro OK')"
```

**Expected output:** `Kokoro OK`

If you see errors:
- `No module named 'kokoro'` → Run `pip3 install kokoro` again
- `espeak not found` → Run `brew install espeak-ng` again

In the app:
1. Open Settings
2. Set **TTS Engine** to `kokoro`
3. Set **Voice** to `af_heart` (or another Kokoro voice)
4. First message will take ~5 seconds (model loading), then ~0.3s per sentence

### Step 4: Configure Voice Input

**Choose one option:**

#### Option A: Type Only (Zero Setup)

Just type in the text box and press Enter. Skip this section entirely.

#### Option B: macOS Dictation (Easy Setup)

1. System Settings → Keyboard → Dictation → Turn On
2. Press the dictation key (default: double-tap Fn) anywhere to speak
3. macOS will type what you say into the OpenCode Talk input box

#### Option C: SuperWhisper (Best Quality - Recommended)

[SuperWhisper](https://superwhisper.com) provides the best transcription quality with local processing.

1. **Install SuperWhisper** from [superwhisper.com](https://superwhisper.com) ($8/month or lifetime)

2. **Install Macrowhisper** (bridges SuperWhisper to apps):
   ```bash
   brew install ognistik/formulae/macrowhisper
   ```

3. **Configure SuperWhisper** (important!):
   - Open SuperWhisper preferences
   - Turn **OFF**: "Paste Result Text"
   - Turn **OFF**: "Restore Clipboard After Paste"  
   - Turn **OFF**: "Simulate Key Presses"
   - Keep **ON**: "Recording Window"

4. **Start Macrowhisper service**:
   ```bash
   macrowhisper --start-service
   ```

5. **In OpenCode Talk Settings**, click "Auto-Configure" or verify the transcription server is receiving.

6. **Test**: Press Option+Space to speak. Your transcription should appear in the input box.

---

## Verify Everything Works

| Test | Expected Result |
|------|-----------------|
| App launches | Window opens, no crash |
| Status shows "Connected" | OpenCode server is running |
| Type a message, press Enter | Response appears + audio plays |
| Audio plays | You hear the response spoken |

If voice input is configured:
| Test | Expected Result |
|------|-----------------|
| Press Option+Space and speak | Your words appear in input box |
| Press Enter | Response with audio |

---

## Troubleshooting

### Build Issues

**`npm install` fails with node-gyp errors:**
```bash
# Install Xcode command line tools
xcode-select --install
```

**`npm run tauri build` fails with Rust errors:**
```bash
# Update Rust
rustup update

# If still failing, try:
cd src-tauri
cargo build --release
```

**Build succeeds but app won't open:**
```bash
# Check for quarantine attribute
xattr -d com.apple.quarantine "src-tauri/target/release/bundle/macos/OpenCode Talk.app"
```

### Connection Issues

**"Not connected to OpenCode":**
1. Make sure OpenCode is running: `opencode serve`
2. Check the port: default is `http://localhost:4096`
3. Check Settings → OpenCode → Server URL

### TTS Issues

**No audio with Kokoro:**
```bash
# Test Kokoro directly
python3 -c "
from kokoro import KPipeline
import soundfile as sf
import numpy as np
pipe = KPipeline(lang_code='a')
audio = list(pipe('Hello world', voice='af_heart', speed=1.2))
if audio:
    print('Kokoro working!')
"
```

**Kokoro fails with espeak error:**
```bash
brew install espeak-ng
```

**Fall back to macOS:**
In Settings, set TTS Engine to `macos`. This always works.

### Voice Input Issues

**SuperWhisper not sending to app:**
1. Check Macrowhisper is running: `macrowhisper --service-status`
2. Restart it: `macrowhisper --stop-service && macrowhisper --start-service`
3. Check SuperWhisper settings (see Step 4 above)

**Hotkeys not working:**
1. System Settings → Privacy & Security → Accessibility
2. Add OpenCode Talk to the list
3. Restart the app

---

## Usage

### Hotkeys

| Action | Hotkey |
|--------|--------|
| Push-to-Talk | `Option + Space` |
| Continuous Mode | `Option + Shift + Space` |
| Interrupt/Stop | `Escape` |

### Voice Commands

- **"New conversation"** - Clear history and start fresh
- **"Yes" / "No"** - Respond to confirmation prompts

---

## Development

```bash
# Run in dev mode (hot reload)
npm run tauri dev

# Build for production
npm run tauri build

# Type check
npm run build
```

See [AGENTS.md](./AGENTS.md) for architecture documentation.
See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

---

## Known Issues

Current limitations and work in progress:

| Issue | Status | Workaround |
|-------|--------|------------|
| Kokoro TTS server must be running separately | Planned | Falls back to Piper/macOS automatically |
| No visual indicator when TTS engine falls back | In Progress | Check console logs |
| Connection can drop without clear notification | Fixed | Now shows Wifi icon status |
| Stopping speech sometimes leaves orphan processes | Fixed | Now tracks PIDs properly |

### Recent Improvements (v0.1.1)

- **Better connection handling** - Visual Wifi/WifiOff indicator, "Connecting..." state
- **Toast notifications** - Errors and warnings now show as dismissible toasts  
- **Safer TTS stop** - Only kills our own audio processes, not system-wide
- **Request cancellation** - Properly aborts in-flight requests when stopping
- **Confirmation timeout** - Pending confirmations auto-cancel after 30 seconds
- **Incomplete response warning** - Messages show warning if response was cut off

---

## Why OpenCode Talk?

- **Hands-free** - Talk while sketching, pacing, or keeping hands on keyboard
- **Lower friction** - Speak naturally instead of typing prompts  
- **Real-time** - Streaming text + voice creates natural dialogue
- **Privacy** - Local TTS keeps conversations on your machine

---

## License

MIT

## Credits

- [OpenCode](https://opencode.ai) - AI coding agent
- [Kokoro](https://github.com/hexgrad/kokoro) - High-quality local TTS
- [SuperWhisper](https://superwhisper.com) - Voice-to-text
- [Tauri](https://tauri.app) - App framework
