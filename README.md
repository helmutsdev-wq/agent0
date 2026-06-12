# Agent0

An AI agent desktop app that routes tasks to the best model across multiple providers — with file editing, terminal execution, and web access.

![Electron](https://img.shields.io/badge/Electron-33.x-47848F) ![React](https://img.shields.io/badge/React-18.x-61DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6) ![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **Multi-provider** — Ollama (local), Gemini, Groq, Hugging Face
- **Smart Routing** — auto-selects the best model per task (coding, research, writing, analysis)
- **Agent Tools** — read/write/edit files, run bash commands, fetch web pages
- **Local Models** — one-click Ollama installer + model pull (no terminal needed)
- **Streaming** — real-time markdown rendering with code highlighting
- **Privacy** — API keys stored locally, never sent to third parties

## Quick Start

```bash
git clone git@github.com:helmutsdev-wq/agent0.git
cd agent0
npm install
npm run dev
```

## Setup

### Option 1: Local (Free, No API Key)

1. Open **Settings > Local Setup**
2. Click **One-Click Install Ollama**
3. Select a model (Llama 3.2 recommended, ~2 GB)

### Option 2: Cloud Providers (Free API Keys)

| Provider | Sign Up | Limits |
|----------|---------|--------|
| **Groq** | [console.groq.com](https://console.groq.com/keys) | Generous free tier |
| **Hugging Face** | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) | Free inference, no credit card |
| **Gemini** | [aistudio.google.com](https://aistudio.google.com/apikey) | 60 req/min free |

Add your keys in **Settings > API Keys**.

## Usage

- Type a message and press Enter to send
- Click the **Agent0** logo or provider name to open Settings
- Toggle **Smart Routing** to auto-pick the best model
- Shift+Enter for multiline input
- Click **Copy** on code blocks
- **New chat** in the bottom bar to clear conversation

## Build for Distribution

```bash
npm run build    # production build
npm run package  # create installer (Windows .exe / Linux .AppImage / macOS .dmg)
```

## Project Structure

```
src/
├── main/          # Electron main process (IPC, file I/O, bash, Ollama installer)
├── preload/       # Secure bridge between main and renderer
└── renderer/
    ├── src/
    │   ├── App.tsx              # Main chat UI + hero empty state
    │   ├── hooks/useChat.ts     # Chat state management + agent orchestration
    │   ├── lib/
    │   │   ├── agent.ts         # Agent reasoning loop (think → tool → observe)
    │   │   ├── tools.ts         # File, bash, web_fetch tool execution
    │   │   ├── router.ts        # NLP task classifier + model ranking
    │   │   └── providers/       # AI provider implementations
    │   └── components/          # UI components
    └── index.html
```

## License

MIT
