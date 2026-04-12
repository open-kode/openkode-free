<div align="center">

![OpenKode Logo](src/assets/logo/ok.png)

# OpenKode Free — 100% Local SDD for VS Code

**The Open Source Spec-Driven Development Agent that runs entirely on your machine.**

[![Version](https://img.shields.io/badge/version-0.1.0--beta-blue.svg)](https://github.com/open-kode/openkode-free/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-^1.85.0-007ACC?logo=visualstudiocode)](https://code.visualstudio.com/)
[![Ollama](https://img.shields.io/badge/Ollama-Compatible-4f46e5?logo=ollama)](https://ollama.com/)
[![LM Studio](https://img.shields.io/badge/LM%20Studio-Compatible-10b981)](https://lmstudio.ai/)

**Plan → Execute → Verify** with zero vibe coding.\
**Zero data leakage.** Your code never leaves your machine.

[📦 Install from VSIX](#quick-start) • [📖 Documentation](https://open-kode.dev/docs) • [🐛 Issues](https://github.com/open-kode/openkode-free/issues)

---

</div>

## 🎯 What is OpenKode?

OpenKode is a **Spec-Driven Development (SDD)** orchestration layer that sits above your favorite AI coding tools (Cursor, Claude Code, Windsurf, etc.).

Instead of jumping straight to code, OpenKode enforces a structured workflow:

```
┌─────────────────────────────────────────────────────────────┐
│  You describe the feature or bug fix                        │
│                      ↓                                      │
│  OpenKode generates a Spec + Acceptance Criteria            │
│                      ↓                                      │
│  Your AI agent implements (Cursor/Claude Code/Windsurf)     │
│                      ↓                                      │
│  OpenKode verifies the diff against the spec                │
│                      ↓                                      │
│  Score ≥ threshold → ✅ Ship  │  Score < threshold → 🔁 Fix  │
└─────────────────────────────────────────────────────────────┘
```

## ✨ Features

### 🔒 100% Private & Local

- **Zero cloud dependencies** — everything runs on your machine
- **No API keys required** — uses Ollama, LM Studio, or llama.cpp
- **No data leakage** — your code never leaves your machine
- **Works offline** — no internet connection required

### 🧩 Four Workflow Modes

| Mode | Icon | Best For | Default Model |
|------|------|----------|---------------|
| **Precision** | 🎯 | Bug fixes, refactors, small features | Qwen2.5-Coder 32B |
| **Blueprint** | 📐 | New features, architecture planning | Qwen2.5-Coder 32B |
| **Visionary** | 🔮 | Research, exploration, discovery | Qwen2.5-Coder 32B |
| **Rocket** | 🚀 | Fast iterations, prototyping | Qwen2.5-Coder 7B |

### 🤖 Agent Handoff

Works with any AI coding agent:
- **Cursor** — copy handoff prompt, paste into Composer
- **Claude Code** — one-click handoff with XML-formatted prompts
- **Windsurf** — Cascade integration
- **Custom agents** — any CLI tool that accepts text input

### ✅ Intelligent Verification

After your agent writes code, OpenKode:
- Captures the `git diff`
- Compares implementation against the spec
- Scores: Critical (−20), Warning (−5), Info (−1), Praise (+2)
- Threshold: 70/100 to pass

### 🔍 Auto-Discovery

- **Intelligent file discovery** — ranks relevant files in large codebases
- **Dependency graph** — understands which functions need changes
- **AST parsing** — analyzes your code structure
- **Symbol indexing** — fast codebase search

## 🚀 Quick Start

### 1. Install the Extension

```bash
# Download the latest release
wget https://github.com/open-kode/openkode-free/releases/download/v0.1.0-beta/openkode-free-0.1.0-beta.vsix

# Install in VS Code
code --install-extension openkode-free-0.1.0-beta.vsix
```

Or install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=openkode.openkode-free) (coming soon).

### 2. Start Your Local LLM

**Option A: Ollama (Recommended)**
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a coding model
ollama pull qwen2.5-coder:32b

# Start the server
ollama serve
```

**Option B: LM Studio**
1. Download [LM Studio](https://lmstudio.ai)
2. Start the local server on port 1234

**Option C: llama.cpp**
```bash
./server -m your-model.gguf --port 8080
```

### 3. Open OpenKode

Press `Ctrl+Shift+O` (or `Cmd+Shift+O` on Mac) to open the OpenKode panel.

### 4. Run the Demo

Press `Ctrl+Shift+P` → "OpenKode: Run Full SDD Demo Cycle" to see it in action.

## 💡 Usage Examples

### Example 1: Fix a Bug

```
🎯 Precision Mode

You: "Fix the null pointer exception in user authentication"

OpenKode generates:
┌─ Spec: Fix NPE in AuthService.login() ─┐
│ Files to touch:                         │
│  - src/auth/AuthService.java            │
│  - src/auth/UserRepository.java         │
│                                         │
│ Acceptance Criteria:                    │
│  ✓ Handle null user object              │
│  ✓ Return 401 for invalid credentials   │
│  ✓ Log security event                   │
└─────────────────────────────────────────┘

[Handoff to Cursor] → [Agent implements] → [Verify: 85/100 ✅]
```

### Example 2: Add a Feature

```
📐 Blueprint Mode

You: "Add Stripe payment integration"

OpenKode generates 4 phases:
┌─ Phase 1: Backend API ─────────────────┐
┌─ Phase 2: Payment Service ─────────────┐
┌─ Phase 3: Frontend Integration ────────┐
┌─ Phase 4: Testing & Documentation ─────┐

Each phase has tickets, specs, and handoff prompts.
```

## 🎹 Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Open OpenKode UI | `Ctrl+Shift+O` | `Cmd+Shift+O` |
| Run Verification | `Ctrl+Shift+V` | `Cmd+Shift+V` |
| Handoff to Agent | `Ctrl+Shift+H` | `Cmd+Shift+H` |

## ⚙️ Configuration

Open VS Code settings (`Ctrl+,`) and search for "openkode":

```json
{
  "openkode.llmProvider": "local",
  "openkode.local.provider": "ollama",
  "openkode.local.ollamaHost": "http://localhost:11434",
  "openkode.local.model": "qwen2.5-coder:32b",
  "openkode.verification.autoVerifyOnSave": false,
  "openkode.verification.scoreThreshold": 70
}
```

## 🆚 OpenKode Free vs Pro

| Feature | Free | Pro |
|---------|:--:|:--:|
| Local LLM (Ollama/LM Studio) | ✅ | ✅ |
| 4 Workflow Modes | ✅ | ✅ |
| Agent Handoff | ✅ | ✅ |
| Verification Engine | ✅ | ✅ |
| Auto-Discovery | ✅ | ✅ |
| Cloud LLM (OpenAI, Claude) | ❌ | ✅ |
| Smart OpenRouter | ❌ | ✅ |
| Backend Relay | ❌ | ✅ |
| Team Collaboration | ❌ | ✅ |
| Priority Support | ❌ | ✅ |
| **Price** | **Free** | **$15/mo** |

## ⬆️ Upgrade to OpenKode Pro

Need cloud LLMs, intelligent model routing, or team features?

### **[Upgrade to OpenKode Pro →](https://open-kode.dev/pro)**

**Pro includes:**
- ☁️ **Cloud LLM support** — OpenAI GPT-4, Claude 3, Gemini Pro
- 🧠 **Smart OpenRouter** — auto-select cheapest capable model
- 🌐 **Backend Relay** — managed team keys with usage tracking
- 👥 **Team collaboration** — shared specs, audit logs
- 🎟️ **Priority support** — dedicated Slack channel

**Pricing:**
- **Pro Individual:** $15/month
- **Pro Team:** $29/user/month

---

## 🛠️ Development

```bash
# Clone the repository
git clone https://github.com/open-kode/openkode-free.git
cd openkode-free

# Install dependencies
npm install

# Build the extension
npm run compile

# Run in development mode
npm run watch
# Press F5 in VS Code
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md).

- 🐛 [Report bugs](https://github.com/open-kode/openkode-free/issues)
- 💡 [Request features](https://github.com/open-kode/openkode-free/issues)
- 🔀 [Submit PRs](https://github.com/open-kode/openkode-free/pulls)

## 📄 License

MIT © OpenKode Contributors

See [LICENSE](LICENSE) for details.

---

<div align="center">

**[⭐ Star this repo](https://github.com/open-kode/openkode-free)** if you find it useful!

Built with ❤️ by the OpenKode team

[Website](https://open-kode.dev) • [Twitter](https://twitter.com/openkode) • [Discord](https://discord.gg/openkode)

</div>
