# Contributing to OpenCode Talk

Thanks for your interest in contributing!

## Quick Start

### Prerequisites

- macOS 13+ (Ventura or later)
- Node.js 18+
- Rust (install via [rustup](https://rustup.rs))
- Python 3.9+ (for Kokoro TTS)

### Setup

```bash
# Clone the repo
git clone https://github.com/dcartertwo/opencode-talk.git
cd opencode-talk

# Install dependencies
npm install

# Install Kokoro TTS (optional but recommended)
pip install kokoro soundfile numpy
brew install espeak-ng

# Run in development mode
npm run tauri dev
```

## Development Workflow

1. **Fork** the repository
2. **Create a branch** for your feature: `git checkout -b feat/my-feature`
3. **Make changes** and test locally
4. **Commit** with conventional commit messages
5. **Push** and open a Pull Request

## Code Style

### TypeScript

- Follow existing patterns in the codebase
- Use Zustand for state management
- Keep components focused and small

### Rust

- Run `cargo fmt` before committing
- Run `cargo clippy` to catch common issues

### Commits

Use conventional commits:

```
feat: add new TTS engine support
fix: resolve audio queue race condition
docs: update installation instructions
refactor: simplify sentence buffer logic
```

## Testing Changes

Since this is primarily a voice interface, testing is manual:

1. **Start OpenCode** in a project: `opencode serve`
2. **Run the app**: `npm run tauri dev`
3. **Test voice input**: Option+Space to speak
4. **Test TTS**: Send a message and verify audio
5. **Test streaming**: Watch real-time text + audio
6. **Test interruption**: Press Escape during playback

### Quick Checks

- [ ] App launches without errors
- [ ] Status bar shows spinner during startup
- [ ] "⌥Space ready" appears when hotkey registered
- [ ] "Ready for voice input" toast appears
- [ ] Red warning shows if hotkey registration fails (test by conflicting hotkey)
- [ ] Connects to OpenCode server
- [ ] Voice input works (if SuperWhisper configured)
- [ ] TTS plays audio
- [ ] TTS engine name appears in status bar
- [ ] Streaming text appears in real-time
- [ ] Interruption stops playback

## Adding Features

### New TTS Engine

See [AGENTS.md](./AGENTS.md#adding-a-new-tts-engine) for detailed steps.

### New Voice Model

Add to the voice selector UI and pass the voice name to the TTS engine.

### New Functionality

1. Check if it fits the project's privacy-first philosophy
2. Prefer local processing over cloud services
3. Update AGENTS.md if adding significant architecture changes

## Reporting Issues

When opening an issue, please include:

- macOS version
- OpenCode Talk version (or commit hash)
- Steps to reproduce
- Expected vs actual behavior
- Console logs if relevant (`npm run tauri dev` shows logs)

## AI-Assisted Development

This project is designed to be AI-friendly. See [AGENTS.md](./AGENTS.md) for:

- Architecture overview
- File reference
- Design decisions
- Extension points

## Project Philosophy

- **Privacy first** - Local TTS preferred, no telemetry
- **Speed matters** - Streaming and warm servers for low latency
- **Natural interaction** - Voice should feel like conversation, not commands
- **Fail gracefully** - Fallbacks for TTS engines, clear error messages

## License

MIT - see [LICENSE](./LICENSE) for details.

By contributing, you agree that your contributions will be licensed under MIT.
