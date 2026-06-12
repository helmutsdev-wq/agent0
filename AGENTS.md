# Agent0 — Agent Guide

## Project Overview

Agent0 is an Electron + React + TypeScript desktop app. It's an AI agent with multi-provider support, file/terminal/web tools, and a smart task router.

## Tech Stack

- **Desktop**: Electron 33 with context isolation + IPC
- **Frontend**: React 18, Vite, Tailwind CSS
- **AI**: Providers use native `fetch` (no heavy SDKs), streaming via ReadableStream
- **Build**: electron-vite, electron-builder

## Key Architecture Decisions

### Providers (`src/renderer/src/lib/providers/`)
Each provider extends `AIProvider` (abstract class in `types.ts`). Registration happens in `index.ts`. Providers must implement `checkAvailability()` and `chat()`.

### Agent Loop (`src/renderer/src/lib/agent.ts`)
1. Check available models → fallback if current model unavailable
2. If routing enabled → classify task → rank models → select best
3. Send messages to provider → stream response
4. Parse tool calls from text output → execute → feed result back
5. Repeat up to 10 iterations

### Tool Calls
Models invoke tools by outputting text in the format:
```
TOOL_CALL: {"name": "tool_name", "input": {...}}
```
Or via JSON code blocks with `tool_calls` array. See `extractToolCalls()` in `agent.ts`.

### Routing (`src/renderer/src/lib/router.ts`)
Keyword-based classifier → scores model capability/quality/speed → picks best. Router is stateless and runs on every message.

### IPC Communication
Main process handlers in `src/main/index.ts`. Preload bridge in `src/preload/index.ts`. Renderer types in `src/renderer/src/env.d.ts`.

## Common Tasks

### Adding a new provider
1. Create `src/renderer/src/lib/providers/<name>.ts`
2. Extend `AIProvider`, implement `chat()` and `checkAvailability()`
3. Register in `src/renderer/src/lib/providers/index.ts`
4. Add API key input in `SettingsDialog.tsx`

### Adding a new tool
1. Add handler in `src/renderer/src/lib/tools.ts`
2. Add IPC handler in `src/main/index.ts` if needed
3. Expose in `src/preload/index.ts` + update `env.d.ts`

### Adding settings
Settings use `SlideOver` component (right sidebar). Add tabs in `SettingsDialog.tsx`.

## Build Commands

```bash
npm run dev       # dev mode with hot reload
npm run build     # production build
npm run package   # platform installer (requires build first)
```

## Desktop-Specific Notes

- **GPU errors** in container/headless: expected, ignore. Real desktop works.
- **Sandbox**: `ELECTRON_DISABLE_SANDBOX=1` needed in restricted environments.
- **Ollama installer**: Windows silent install via `/S` flag on `OllamaSetup.exe`.

## Git Conventions

- Commit per feature/step
- Push after each commit (`git push`)
- Remote: `github-second` (SSH host alias for second GitHub account)
