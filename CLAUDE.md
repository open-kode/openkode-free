# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run compile       # TypeScript → out/
npm run watch         # Watch mode compilation
npm run package       # Production .vsix build (esbuild)
npm run lint          # ESLint on src/
npm run typecheck     # Type-check only
npm run test:unit     # Jest unit tests
npm run test:coverage # Jest with coverage report
npm run clean         # Remove out/
```

## Dev setup

```bash
# Terminal 1: npm run watch
# VS Code: F5 → Extension Development Host
```

## Architecture

OpenKode is a **VSCode extension** for AI-assisted Spec-Driven Development. All UI runs inside VS Code WebView panels — there is no separate browser app or backend server.

```
VSCode Extension (src/)
  ├── extension.ts          # Entry point: registers commands, sidebar provider
  ├── ui/sidebarPanel.ts    # Primary UI in the activity bar sidebar (WebviewView)
  ├── ui/mainPanel.ts       # Full-panel WebView (opened via command)
  ├── ui/statusBar.ts       # Status bar item
  ├── llm/llmClient.ts      # Unified LLM provider interface (OpenAI, Anthropic, Gemini)
  ├── core/                 # Chat store, personas, agent service, intent detection
  ├── vibe/                 # Mode engine, file writer, context reader, vibe engine
  ├── spec/                 # Intent capture, decomposer, planner, validator, store
  ├── orchestration/        # Router, state manager, context manager, parallel executor
  ├── codebase/             # AST parser, dependency graph, symbol index, vector search
  ├── verification/         # Verifier, diff reviewer, regression detector, static analysis
  └── agent-handoff/        # Handoff protocol, agent registry, Cursor/ClaudeCode integrations
```

## Key Types

All shared types are in `src/types/index.ts`.

## LLM Providers

`src/llm/llmClient.ts` implements a unified multi-provider interface supporting OpenAI, Anthropic, and Google Generative AI. API keys are stored in the VS Code secrets store (not config files).

## UI flow

The sidebar (`openkode.sidebarPanel`) is the primary UI. It walks the user through:
1. Welcome / login (dummy auth gate)
2. LLM provider selection
3. API key input (stored via `context.secrets`)
4. Main chat + mode selection (Precision / Blueprint / Visionary / Rocket)
