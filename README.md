
<!-- OPENKODE EDITION BANNER -->
<div align="center">

[![OpenKode Free](https://img.shields.io/badge/OpenKode-Free-blue.svg?style=for-the-badge)](https://github.com/open-kode/openkode-free)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

### 🚀 OpenKode Free — Local-first SDD

**100% Open Source • 100% Local LLM • Zero Data Leakage**

[Upgrade to Pro](https://open-kode.dev/pro) for smart cloud routing + team features

</div>

---

# OpenKode Free — Local-first SDD

The fully open-source VS Code extension that enforces **Spec-Driven Development** (SDD):  
Plan → Execute → Verify with zero vibe coding.

**100% local LLM only** (Ollama, LM Studio, llama.cpp).  
Upgrade to OpenKode Pro for smart cloud routing, team features, and backend relay → [open-kode.dev/pro](https://open-kode.dev/pro)

---

[![Version](https://img.shields.io/badge/version-0.1.0--beta-blue.svg)](https://github.com/openkode/openkode-free)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-^1.85.0-007ACC?logo=visualstudiocode)](https://code.visualstudio.com/)
[![Local LLM](https://img.shields.io/badge/Local%20LLM-Ollama%20%7C%20LM%20Studio-green)](https://ollama.com/)

> **The only SDD orchestration layer with true Bring-Your-Own-LLM — Cloud OR fully local, zero data leakage.**

![OpenKode hero banner](https://raw.githubusercontent.com/openkode/openkode-vscode/main/src/assets/logo/img/banner.png)

---

## Why OpenKode?

AI coding tools (Cursor, Claude Code, Windsurf) are _execution_ engines. They write code fast. But they all share the same fatal flaw: **vibe coding** — they skip planning, skip acceptance criteria, and skip verification. You get code that works *now* but breaks *tomorrow*.

OpenKode is the **outer loop** that wraps your AI agents with senior-engineer discipline:

```
You describe the task
     │
     ▼
OpenKode generates a Spec + Acceptance Criteria
     │
     ▼
Your AI agent (Cursor / Claude Code / Windsurf) implements it
     │
     ▼
OpenKode's LLM Verifier checks the diff against the spec
     │
     ▼
Score ≥ threshold → ✅ Ship  │  Score < threshold → 🔁 Fix
```

---

## Features

### 🔌 True BYO-LLM Router

Run **fully local** (zero cloud, zero data leakage) or plug in your cloud key — or use the OpenKode managed relay for teams. Switch between providers in one click.

| Mode | Providers | Data stays local? | Edition |
|------|-----------|:-----------------:|:-------:|
| **Local** | Ollama, LM Studio, llama.cpp | ✅ Yes | Free + Pro |
| **Cloud Key** | OpenAI, Anthropic, xAI, Gemini | ❌ No | Pro only |
| **OpenKode Relay** | Managed Pro/Team plan | ❌ No | Pro only |

> **Free edition** locks to Local mode. Selecting Cloud Key or Relay shows an upgrade prompt.  
> Switch with **Ctrl+Shift+O → Select LLM Provider**

---

### 🧩 4 Workflow Modes

| Mode | Icon | Best For | Default LLM |
|------|------|----------|------------|
| **Precision** | 🎯 | Architecture decisions, complex refactors | Cloud / Claude 3.7 Sonnet |
| **Blueprint** | 📐 | Spec authoring, planning new features | Local / Qwen2.5-Coder 32B |
| **Visionary** | 🔮 | Product ideation, research | Cloud / Claude 3.7 Sonnet |
| **Rocket** | 🚀 | Fast iteration, bug fixes, small tasks | Local / Qwen2.5-Coder 32B |

Each mode applies a **Model Profile** — you can customise which LLM drives each mode from the sidebar.

---

### 🤖 Agent Handoff (Cursor · Claude Code · Windsurf · Custom)

OpenKode generates a context-rich handoff prompt that includes:
- Active workflow mode and LLM being used
- Current spec and acceptance criteria
- Relevant code context from the open editor
- Per-agent instruction style (Cursor uses rules syntax, Claude Code uses XML tags, etc.)

The prompt is copied to your clipboard so you can paste it into any agent with one keystroke.

**Keyboard shortcut**: `Ctrl+Shift+H` while code is selected.

---

### ✅ LLM Verification Engine

After your agent writes code, OpenKode captures the `git diff` and sends it — alongside the spec — to a senior-engineer LLM reviewer. Results appear in the **Verification** sidebar panel and inline as VS Code diagnostics.

| Severity | Score Impact | Shown As |
|----------|-------------|----------|
| Critical | −20 pts each | Error diagnostic |
| Warning | −5 pts each | Warning diagnostic |
| Info | −1 pt each | Info hint |
| Praise | +2 pts each (capped at 10) | — |

Score threshold default: **70/100** (configurable). Auto-verify on save is toggleable.

---

### 🖼️ Screenshots

> *(Beta placeholders — full screenshots coming in v1.0)*

- **Sidebar**: Model Profiles tree + Verification report panel
- **Notification**: `OpenKode Verify: 82/100 — Minor issues found [View Report]`
- **Status bar**: `$(cpu) Local • qwen2.5-coder:32b` | `$(pass) Verify: 82/100`

---

## Quick Start — 60-Second Demo

1. **Install** the extension from the Marketplace (or press `F1` → *Extensions: Install from VSIX*)
2. **Open the welcome screen**: `F1` → *OpenKode: Welcome / Quick Start*
3. **Choose your LLM**: Click the status bar chip or press `Ctrl+Shift+O` → *Select LLM Provider*
4. **Run the built-in demo**: `F1` → *OpenKode: Run Full SDD Demo Cycle*  
   Watch OpenKode generate a spec, hand it off to a mock agent, and verify the result — all in under 60 seconds.
5. **Open your real project** and press `F1` → *OpenKode: Open OpenKode UI* to start your first spec.

---

## BYO-LLM Setup Guide

### Local — Ollama (recommended for privacy)

```bash
# 1. Install Ollama   https://ollama.com
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull a coding model
ollama pull qwen2.5-coder:32b   # 20 GB — best quality
ollama pull qwen2.5-coder:7b    # 4 GB  — fast and lightweight

# 3. Verify it is running
curl http://localhost:11434/api/tags
```

In VS Code settings (`Ctrl+,`):
```json
"openkode.llmProvider": "local",
"openkode.local.provider": "ollama",
"openkode.local.model": "qwen2.5-coder:32b"
```

### Local — LM Studio

1. Download [LM Studio](https://lmstudio.ai) and start the local server (port 1234)
2. Set `"openkode.local.provider": "lmstudio"` in settings

### Cloud — Anthropic Claude

```json
"openkode.llmProvider": "cloud-key",
"openkode.cloud.provider": "anthropic",
"openkode.cloud.model": "claude-3-7-sonnet-20250219"
```

Then run `F1` → *OpenKode: Select LLM Provider* → **Cloud Key** to securely enter your API key (stored in VS Code SecretStorage, never in plain text).

---

## Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|--------------|-------|
| Open OpenKode UI | `Ctrl+Shift+O` | `Cmd+Shift+O` |
| Run Verification | `Ctrl+Shift+V` | `Cmd+Shift+V` |
| Handoff to Cursor | `Ctrl+Shift+H` | `Cmd+Shift+H` |

Right-click any selected code to get the **OpenKode** context menu with all handoff + verify options.

---



## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `openkode.llmProvider` | `local` | `local` \| `cloud-key` \| `openkode-relay` |
| `openkode.local.provider` | `ollama` | `ollama` \| `lmstudio` \| `llamacpp` |
| `openkode.local.model` | `qwen2.5-coder:32b` | Model name for local server |
| `openkode.cloud.provider` | `openai` | `openai` \| `anthropic` \| `xai` \| `gemini` |
| `openkode.cloud.model` | `claude-3.7-sonnet` | Cloud model name |
| `openkode.verification.autoVerifyOnSave` | `false` | Auto-verify on file save |
| `openkode.verification.scoreThreshold` | `70` | Minimum passing score (0–100) |
| `openkode.telemetry.enabled` | `false` | Anonymous usage telemetry (opt-in) |

---

## Privacy

- **Local mode**: 100% private. Your code never leaves your machine.
- **Cloud-key mode**: your API key is stored in VS Code's encrypted [SecretStorage](https://code.visualstudio.com/api/references/vscode-api#SecretStorage). OpenKode itself never touches it beyond forwarding to the provider you chose.
- **Telemetry**: Disabled by default. When opted in, only anonymous event names are sent (e.g. `verification.run`) — no code, no prompts, no file names, no personal data.

---

## Contributing

```bash
git clone https://github.com/openkode/openkode-vscode
cd openkode-vscode/OpenKode-FrontEnd
npm install
npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

Issues and PRs welcome: [github.com/openkode/openkode-vscode/issues](https://github.com/openkode/openkode-vscode/issues)

---

## License

MIT © OpenKode Contributors

OpenKode is an AI-powered **Spec-Driven Development (SDD)** platform that functions as an "outer loop" orchestration layer sitting above your existing AI coding agents (Cursor, Claude Code, Windsurf, etc.). Rather than replacing your coding tools, OpenKode upgrades them with structured planning, verification, and workflow management.

## 🎯 Core Philosophy

OpenKode addresses the fundamental flaw in most AI coding tools: "vibe coding" where agents immediately jump to implementation without understanding the full context. OpenKode enforces a **Plan → Execute → Verify** workflow that mirrors how senior engineers actually work.

## ✨ Key Features

### 1. Multi-Model Architecture (Ensemble AI)

OpenKode doesn't rely on a single LLM. Instead, it uses a team of specialized models:

| Role | Purpose |
|------|---------|
| **Planner** | High-level task decomposition, spec creation, architecture decisions |
| **Verifier** | Code review, regression detection, debugging, plan alignment checks |
| **Scout** | Fast parallel codebase scanning, file discovery, relevance ranking |
| **Researcher** | External documentation lookup, library patterns, web search |
| **Summarizer** | Context compression, tool output processing |

### 2. Four Workflow Modes

OpenKode provides four primary workflows based on task complexity:

#### 🎯 Precision Mode
Single-phase tactical changes with detailed implementation specs. Perfect for:
- Bug fixes
- Small feature additions
- Refactoring tasks
- Quick optimizations

#### 🏗️ Blueprint Mode
Multi-phase decomposition for complex features. Example:
```
"Add Stripe integration" 
→ Backend API → Payment Service → Frontend → Testing → Documentation
```

#### 🔭 Visionary Mode
High-level intent capture with ticket generation and end-to-end execution tracking. Ideal for:
- Major features
- Architectural changes
- Cross-cutting concerns

#### 🚀 Rocket Mode
Fully automated execution where OpenKode iterates through phases automatically with minimal human intervention.

### 3. Spec-Driven Development Pipeline

The core workflow follows a strict 5-step process:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Intent Capture  │────▶│ Phase Decompose  │────▶│ Tactical Plan   │
│    (PRD)        │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
┌─────────────────┐     ┌──────────────────┐              │
│   Verification  │◀────│  Agent Handoff   │◀─────────────┘
│                 │     │                  │
└─────────────────┘     └──────────────────┘
```

### 4. Agent-Agnostic Integration

OpenKode supports 15+ AI agents including:

- **Cursor**, **Claude Code**, **Windsurf**
- **Codex CLI**, **Gemini CLI**
- **Aider**, **Continue**
- Custom CLI agents with environment variable injection (`OPENKODE_PROMPT`, `OPENKODE_PHASE_ID`, etc.)

### 5. Context-Aware Codebase Analysis

- **Intelligent file discovery**: Ranks relevant files across large codebases
- **Dependency graph understanding**: Identifies which functions need changes
- **Context preservation**: Maintains project understanding across phases
- **Change tracking**: Detailed logs with rollback capabilities

### 6. Verification & Quality Guardrails

Unlike simple linting, OpenKode's verification checks:

- ✅ **Plan alignment**: Did the implementation match the spec?
- ✅ **Regression detection**: Did the agent break existing functionality?
- ✅ **Security analysis**: Injection risks, auth issues, secret exposure
- ✅ **Architectural integrity**: Modularity, coupling, abstraction boundaries
- ✅ **Test execution**: Automated test running and validation

## 🚀 Quick Start

### Installation

```bash
# From VSCode Marketplace (when available)
code --install-extension openkode

# Or from VSIX
code --install-extension openkode-0.1.0.vsix
```

### Usage

1. **Open the OpenKode panel** from the activity bar (icon: 🔷)

2. **Select a mode** in the sidebar chat panel
   (Precision / Blueprint / Visionary / Rocket)

3. **Follow the workflow**:
   - Describe your intent
   - Review the generated spec
   - Approve for execution
   - Verify the results

## ⚙️ Configuration

Configure OpenKode through VSCode settings (`Ctrl+,` → search "OpenKode"):

| Setting | Description | Default |
|---------|-------------|---------|
| `openkode.enabled` | Enable OpenKode extension | `true` |
| `openkode.aiProvider` | AI provider | `"openai"` |
| `openkode.model` | AI model to use | `gpt-4` |
| `openkode.logLevel` | Logging level (`debug`/`info`/`warn`/`error`) | `info` |

API keys are stored securely in the VS Code secrets store, not in settings.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        OpenKode Extension                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │   Precision Mode │  │ Blueprint Mode │  │ Visionary Mode │ Rocket Mode │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────────┘  │
│         │                │                                       │
│  ┌──────▼────────────────▼────────────────────────────────────┐  │
│  │              Spec-Driven Development Pipeline               │  │
│  │  Intent → Decompose → Plan → Handoff → Verify              │  │
│  └────────────────────────────────────────────────────────────┘  │
│         │                                                        │
│  ┌──────▼────────────────────────────────────────────────────┐  │
│  │              Multi-Agent Orchestration Engine               │  │
│  │  Router │ State Manager │ Parallel Executor │ Model Client  │  │
│  └────────────────────────────────────────────────────────────┘  │
│         │                                                        │
│  ┌──────▼────────────────────────────────────────────────────┐  │
│  │              Codebase Intelligence Layer                    │  │
│  │  File Discovery │ AST Parser │ Dependencies │ Vector Search │  │
│  └────────────────────────────────────────────────────────────┘  │
│         │                                                        │
│  ┌──────▼────────────────────────────────────────────────────┐  │
│  │              Verification & Quality Guardrails              │  │
│  │  Diff Review │ Regression │ Static Analysis │ Security      │  │
│  └────────────────────────────────────────────────────────────┘  │
│         │                                                        │
│  ┌──────▼────────────────────────────────────────────────────┐  │
│  │              Agent Handoff Protocol                         │  │
│  │  Cursor │ Claude Code │ Windsurf │ Custom CLI Agents       │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
openkode/
├── src/
│   ├── extension.ts              # Main entry point
│   ├── core/
│   │   ├── openkode.ts           # Main OpenKode class
│   │   └── workflowModes.ts      # 4 workflow modes
│   ├── orchestration/
│   │   ├── router.ts             # Multi-model router
│   │   ├── stateManager.ts       # Workflow state machine
│   │   ├── parallelExecutor.ts   # Parallel execution
│   │   ├── contextManager.ts     # Context optimization
│   │   └── modelClient.ts        # LLM client
│   ├── spec/
│   │   ├── intentCapture.ts      # Intent/PRD capture
│   │   ├── decomposer.ts         # Phase decomposition
│   │   ├── tacticalPlanner.ts    # Tactical planning
│   │   ├── specValidator.ts      # Spec validation
│   │   └── specStore.ts          # Spec storage
│   ├── codebase/
│   │   ├── fileDiscovery.ts      # File discovery
│   │   ├── astParser.ts          # AST parsing
│   │   ├── dependencyGraph.ts    # Dependency analysis
│   │   ├── vectorSearch.ts       # Semantic search
│   │   ├── symbolIndex.ts        # Symbol indexing
│   │   └── contextAssembler.ts   # Context assembly
│   ├── verification/
│   │   ├── diffReviewer.ts       # Diff review
│   │   ├── regressionDetector.ts # Regression detection
│   │   ├── staticAnalysis.ts     # Static analysis
│   │   ├── securityScanner.ts    # Security scanning
│   │   ├── testRunner.ts         # Test execution
│   │   └── verifier.ts           # Main verifier
│   ├── agent-handoff/
│   │   ├── agentRegistry.ts      # Agent registration
│   │   ├── handoffProtocol.ts    # Handoff protocol
│   │   ├── cursorIntegration.ts  # Cursor integration
│   │   ├── claudeCodeIntegration.ts # Claude Code
│   │   ├── customAgent.ts        # Custom agents
│   │   └── resultParser.ts       # Result parsing
│   ├── ui/
│   │   ├── planViewer.ts         # Plan viewer panel
│   │   ├── epicTreeProvider.ts   # Epic tree view
│   │   ├── verificationPanel.ts  # Verification panel
│   │   ├── statusBar.ts          # Status bar
│   │   └── webview/              # React components
│   ├── types/
│   │   └── index.ts              # Type definitions
│   └── utils/
│       ├── logger.ts             # Logging
│       ├── fileUtils.ts          # File operations
│       ├── gitUtils.ts           # Git operations
│       ├── configManager.ts      # Configuration
│       └── errorHandler.ts       # Error handling
├── package.json                  # Extension manifest
├── tsconfig.json                 # TypeScript config
├── esbuild.js                    # Build script
└── README.md                     # This file
```

## 🛠️ Development

### Prerequisites

- Node.js 18+
- VSCode 1.85+
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/openkode/openkode-vscode.git
cd openkode-vscode

# Install dependencies
npm install

# Compile
npm run compile

# Watch mode for development
npm run watch
```

### Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

### Packaging

```bash
# Package as VSIX
npm run package

# Or use vsce directly
vsce package
```

### Debug

1. Open the project in VSCode
2. Press `F5` to launch the Extension Development Host
3. Test the extension in the new window

## 📝 Example Workflows

### Precision Mode Example

```typescript
// User input: "Add input validation to the login form"

// Generated Spec:
{
  "intent": "Add input validation to login form",
  "filesToTouch": [
    "src/components/LoginForm.tsx",
    "src/utils/validation.ts",
    "src/tests/LoginForm.test.tsx"
  ],
  "interfaces": {
    "ValidationRule": "interface ValidationRule { field: string; rules: string[]; }"
  },
  "steps": [
    "Add email validation function",
    "Add password validation function",
    "Integrate validation into LoginForm",
    "Add error message display",
    "Write tests"
  ],
  "acceptanceCriteria": [
    "Email must be valid format",
    "Password must be 8+ characters",
    "Errors display inline"
  ]
}
```

### Blueprint Mode Example

```typescript
// User input: "Implement user authentication with JWT"

// Generated Phases:
[
  {
    "name": "Backend API",
    "tickets": [
      "Create auth middleware",
      "Implement login endpoint",
      "Implement register endpoint",
      "Add JWT token generation"
    ]
  },
  {
    "name": "Database",
    "tickets": [
      "Create users table",
      "Add password hashing",
      "Create refresh tokens table"
    ]
  },
  {
    "name": "Frontend",
    "tickets": [
      "Create login page",
      "Create register page",
      "Add auth context",
      "Implement protected routes"
    ]
  },
  {
    "name": "Testing",
    "tickets": [
      "Unit tests for auth service",
      "Integration tests for API",
      "E2E tests for login flow"
    ]
  }
]
```

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.


## 📞 Support

- 🐛 [Report bugs](https://github.com/openkode/openkode-vscode/issues)
- 💡 [Request features](https://github.com/openkode/openkode-vscode/issues)
- 💬 [Discussions](https://github.com/openkode/openkode-vscode/discussions)

---

**Happy Coding with OpenKode! 🚀**
