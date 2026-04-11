

# OpenKode: Specification-Driven Development Platform — Complete Technical Blueprint

## 1. Executive Architecture Overview

### 1.1 Core System Design Philosophy

#### 1.1.1 Specification-First Development Paradigm

The foundational philosophy of OpenKode draws directly from Traycer's proven approach to specification-driven development, which has demonstrated that capturing intent as **"living specs"** dramatically reduces the drift between human intention and AI-generated implementation. The core insight from Traycer's methodology is that AI agents excel at producing code but consistently struggle with understanding and preserving the **"why"** behind decisions—the constraints, edge cases, and invisible rules that teams already know. OpenKode therefore prioritizes structured specification capture before any code generation occurs, transforming vague requirements into concrete, reviewable artifacts through AI-assisted dialogue that actively elicits constraints rather than passively accepting prompts.

This specification-first paradigm operates on three interconnected principles: **intent crystallization**, **iterative refinement**, and **executable handoff**. Intent crystallization transforms vague requirements into concrete, reviewable artifacts through a two-sided dialogue that forces ambiguity to collapse into explicit decisions. This dialogue probes for constraints, edge cases, and assumptions that might otherwise remain implicit until they cause implementation failures. Iterative refinement replaces the traditional "giant spec" anti-pattern with a system of **mini-specs**—tightly scoped documents that can evolve independently without cascading changes. Each mini-spec addresses a specific aspect: product requirements, technical architecture, user experience design, or API contracts. When reality changes, only the relevant mini-spec requires updates, maintaining system coherence without documentation rot. The executable handoff principle ensures that specifications are not dead documents but living artifacts that can be directly consumed by AI coding agents, with a structured schema that preserves semantic relationships, dependencies, and validation criteria.

The specification serves as a **contract between human intent and machine execution**, enabling precise verification and meaningful rollback capabilities that would be impossible in traditional conversational coding interfaces. This approach addresses a critical failure mode observed in conventional AI coding assistants: the tendency to produce code that "works once" and then deteriorates when integrated into real codebases. By separating planning from execution, OpenKode ensures that AI agents operate from a coherent, validated understanding of what needs to be built rather than making implicit assumptions that lead to drift and regression.

#### 1.1.2 Plan-Execute-Verify Workflow Engine

OpenKode's workflow engine implements a rigorous **three-phase execution model** that mirrors established software engineering best practices while adapting them for AI-augmented development. The **Plan** stage decomposes high-level specifications into discrete, verifiable tasks with explicit dependencies and success criteria, generating a directed acyclic graph (DAG) that enables parallel execution where possible. The planning phase leverages specialized AI agents configured for strategic analysis, producing comprehensive implementation roadmaps that include edge case identification, dependency mapping, and resource estimation. The **Execute** stage orchestrates AI agents to generate implementation code against these well-defined targets, maintaining context continuity across file boundaries and handling multi-file coordination. The **Verify** stage applies multi-layered quality assurance—static analysis, semantic diffing, automated testing, and human review—to ensure generated code meets both functional requirements and quality standards.

This orchestration is not merely sequential; it supports **iterative refinement loops** where verification failures trigger replanning, execution errors inform specification updates, and human feedback improves agent behavior over time. Critical to this engine is the **checkpoint system**: at each stage completion, the system captures a recoverable state enabling rollback to any previous point. This supports both automated recovery from agent failures and human-initiated reconsideration of approach. The workflow engine handles the reality that AI agents may produce partially correct implementations—verification results feed back into re-planning loops for iterative improvement.

The phased approach is particularly valuable for large-scale refactoring operations where the scope of changes spans multiple files and modules, as it allows developers to assess the cumulative impact of modifications before committing to irreversible transformations. Real-world implementations using similar methodologies have reported **reducing feature development time from two days to four hours** while simultaneously improving code quality beyond manually written standards. This efficiency gain stems from the elimination of iterative correction cycles that plague prompt-to-code workflows, where developers spend substantial time explaining requirements and retrofitting generated code to match actual needs.

#### 1.1.3 Multi-Agent Orchestration Framework

Modern AI-assisted development increasingly relies on **specialized agents** rather than monolithic systems. OpenKode's orchestration framework enables coordinated multi-agent execution, where different agents handle different aspects of a specification based on their capabilities. This approach mirrors how senior engineering teams operate: a project manager coordinates specialists who each handle their domain of expertise.

| Agent Type | Function | Trigger Condition | Optimal Model |
|------------|----------|-------------------|---------------|
| **Planning Agent** | Decomposes specifications into implementation tasks | Specification creation or major revision | Claude 3 Opus, GPT-4 |
| **Coding Agent** | Generates code across multiple files | Task handoff from planning | Claude 3.5 Sonnet, GPT-4 Turbo |
| **Review Agent** | Analyzes implementation against specification | Post-generation verification | Claude 3 Opus (reasoning) |
| **Fix Agent** | Applies targeted corrections based on review findings | Verification failure with actionable diagnosis | Same as Coding Agent |
| **Documentation Agent** | Synchronizes code comments with specification changes | Any implementation merge | GPT-3.5 Turbo, local models |

The framework implements a **publish-subscribe pattern** where agents communicate through structured events, enabling loose coupling and independent scaling. Each agent maintains its own context window management strategy optimized for its function—planning agents prioritize broad codebase understanding, while coding agents focus on deep local context with relevant cross-file references. **Context preservation across agent boundaries** is managed through structured handoff protocols that package not just task descriptions but full architectural context: how components fit together, what interfaces they expose, what invariants must be maintained, and what test coverage exists.

Agent selection can be automatic (based on file type, task description, or historical performance) or manual (developer explicitly assigns tasks to preferred agents). The framework tracks agent performance metrics—success rate by task type, latency, token efficiency, code quality scores—to inform routing decisions and identify when additional agent specialization would be beneficial. This **capability-based routing** with **quality-aware fallback** ensures robust operation: tasks requiring extended context (200k tokens) route to Claude; tasks requiring function calling route to GPT-4; simple tasks route to faster, cheaper models with automatic escalation if quality thresholds are not met.

### 1.2 Technology Stack Selection

#### 1.2.1 Python Implementation Rationale

Python emerges as the primary implementation language for OpenKode based on several technical and ecosystem considerations. The Python ecosystem provides mature, production-ready libraries for every component of the specification-driven development pipeline: **`tree-sitter`** and **`libcst`** for AST-based code analysis; **`pydantic`** for structured data validation; **`asyncio`** for concurrent agent communication; **`rich`** and **`textual`** for sophisticated terminal user interfaces; and **`pytest`** with **`hypothesis`** for comprehensive testing.

| Domain | Python Ecosystem Advantage | Alternative Consideration |
|--------|---------------------------|---------------------------|
| **AI/ML Integration** | Native `openai`, `anthropic`, `transformers` libraries | Node.js SDKs are secondary |
| **Code Analysis** | `tree-sitter`, `libcst`, `jedi` for multi-language parsing | Node.js requires WASM or subprocess |
| **Async Concurrency** | Mature `asyncio` with structured concurrency | Node.js event loop is comparable |
| **Terminal UI** | `rich` (rendering) + `textual` (TUI framework) | `ink` (React-based) is viable |
| **Type Safety** | `pydantic` + `mypy` provides runtime + static validation | TypeScript has native advantage |
| **Scientific Computing** | `numpy`, `scipy`, `faiss` for embeddings and similarity | No direct equivalent in JS |

Python's dominance in AI/ML infrastructure ensures seamless integration with model serving frameworks. Whether connecting to OpenAI's API, running local models through `llama-cpp-python`, or deploying custom fine-tuned models with `transformers`, Python provides first-class support. This eliminates friction that would arise from language boundaries in a multi-runtime system.

The language's readability and introspection capabilities are particularly valuable for a developer tool. **OpenKode's own codebase serves as a demonstration of the practices it promotes**—clean, well-documented, testable code that AI agents can understand and modify. Python's dynamic nature enables runtime inspection and modification, supporting advanced features like live specification reloading and plugin hot-swapping without process restart.

For performance-critical paths, Python's C extension ecosystem and `mypyc` compilation provide optimization pathways without abandoning the core language. The AST analysis engine, which must process potentially millions of lines of code, can leverage `tree-sitter`'s Rust core while presenting a Pythonic API. Similarly, the embedding cache for semantic similarity can use `faiss` or `annoy` for vector operations while maintaining Python orchestration.

#### 1.2.2 Alternative Node.js/npm Pathway

While Python is recommended for OpenKode's core implementation, a Node.js/npm pathway remains viable for organizations with existing JavaScript/TypeScript expertise or specific integration requirements. The JavaScript ecosystem offers compelling alternatives: `typescript` itself for type-safe specification schemas, `tree-sitter` bindings for code analysis, `ink` and `blessed` for terminal UIs, and `vitest` for testing.

| Aspect | Node.js Advantage | Node.js Challenge |
|--------|-----------------|-------------------|
| **Frontend Integration** | Native TypeScript, seamless React/Vue/Angular codegen | Python requires separate tooling |
| **JSON Handling** | Native, no serialization friction | Minor advantage |
| **Developer Familiarity** | Teams already using JS/TS for full-stack | Context switching if backend is Python |
| **Code Analysis** | Requires WASM bindings or language servers | Significant integration effort |
| **AI/ML Libraries** | `transformers.js` emerging but immature | Substantial capability gap |
| **Local Model Inference** | Limited options, mostly cloud-dependent | Privacy/cost concerns |

The npm pathway is particularly attractive for teams already embedded in the JavaScript tooling ecosystem. If the target codebase for OpenKode integration is primarily JavaScript/TypeScript, implementing OpenKode in the same language enables **dogfooding**—using OpenKode to develop and maintain OpenKode itself. This creates tight feedback loops for feature development and ensures the tool works well for its primary use case.

However, the npm pathway faces challenges in AI infrastructure maturity. While `openai` and `@anthropic-ai/sdk` provide API clients, the ecosystem for local model inference, vector databases, and ML pipelines is less developed than Python's. Teams choosing this path should budget additional integration effort for components that Python provides out-of-the-box.

A **hybrid architecture** is also feasible: core orchestration in Python with JavaScript/TypeScript-specific analysis modules running as language servers or WASM plugins. This approach maximizes ecosystem leverage while maintaining language-appropriate tooling for each target codebase.

#### 1.2.3 Desktop-Native Constraints and Implications

The explicit requirement that OpenKode "should not be web-based or app-based at this stage" fundamentally shapes the architecture, eliminating browser-based UIs and mobile applications from consideration. This constraint reflects practical development priorities: **terminal-native tools integrate more naturally with existing developer workflows**, avoid the complexity of distributed systems (backend services, databases, authentication infrastructure), and enable offline operation essential for air-gapped or latency-sensitive environments.

| Desktop-Native Capability | Web-Based Equivalent | OpenKode Advantage |
|---------------------------|----------------------|----------------------|
| Direct filesystem access | Sandboxed storage APIs | Full git integration, native file watching |
| Subprocess execution | Restricted/impossible | Invoke compilers, linters, test runners directly |
| Shell environment integration | None | Inherit PATH, environment variables, aliases |
| Local model inference | Requires hosted API | Privacy, cost control, offline operation |
| Editor integration | LSP over WebSocket | Native LSP, direct buffer manipulation |

Desktop-native implementation implies several architectural decisions:

**Process Model**: OpenKode runs as a **single-user process with direct filesystem access**. There is no multi-tenancy, no request routing, no session management in the web application sense. The process lifecycle is tied to developer activity: launched from shell, interactive operation, graceful shutdown on exit. This simplicity eliminates entire categories of bugs (race conditions in shared state, request timeouts, connection pool exhaustion) while enabling features (direct editor integration, filesystem watching, subprocess management) that would require complex capability bridging in a web context.

**Storage Architecture**: All state is local—specifications in Git-tracked files, caches in SQLite or local directories, configuration in XDG-compliant paths. No cloud synchronization, no collaborative editing, no server-side persistence. This aligns with developer expectations for CLI tools and enables version control integration where specifications evolve alongside code.

**UI Paradigm**: The interface is **terminal-native with optional GUI enhancements** through terminal multiplexers or native widget libraries. The primary interaction mode is keyboard-centric with command palettes, shortcuts, and REPL-style conversations. Visual richness is achieved through libraries like `rich` (Python) or `ink` (Node.js) rather than HTML/CSS rendering.

**Security Posture**: Local execution means API keys for AI services are stored in OS keychains, code never leaves the developer's machine unless explicitly sent to external APIs, and sandboxed execution can use container technologies (Docker, Podman) without network exposure concerns. This addresses the security consciousness that leads organizations to prefer local AI tooling.

The desktop-native constraint does not preclude future web or collaborative extensions. The core specification engine and agent integration layer are designed as libraries that could be wrapped in a web service or exposed through language servers. But the initial implementation prioritizes **single-developer, local-first operation** as the foundation for reliable, predictable behavior.

### 1.3 Integration Architecture with Existing Codebases

#### 1.3.1 Codebase Analysis and Ingestion Pipeline

Effective specification-driven development requires deep understanding of the target codebase. OpenKode's ingestion pipeline performs **multi-stage analysis** to build a comprehensive model of code structure, semantics, and conventions.

| Stage | Function | Output | Performance Target |
|-------|----------|--------|------------------|
| **1. File System Discovery** | Configurable traversal respecting `.gitignore` | Classified file list with metadata | <1s for 10k files |
| **2. Syntactic Analysis** | Tree-sitter parsing to CSTs | Structural graph (modules, classes, functions) | <5s incremental |
| **3. Semantic Enrichment** | Type inference, cross-reference resolution | Semantic graph with dependency edges | <30s initial |
| **4. Convention Learning** | Pattern extraction from existing code | Style rules, architectural patterns | Background, continuous |
| **5. Embedding Generation** | Vector representations for similarity search | Searchable vector index | Batch, cached |

**Stage 1: File System Discovery** begins with configurable file discovery, respecting `.gitignore` patterns and project-specific exclusion rules. For large codebases, incremental discovery tracks modification times to avoid reprocessing unchanged files. Discovered files are classified by language and purpose—source code, configuration, documentation, generated artifacts—enabling language-appropriate analysis.

**Stage 2: Syntactic Analysis** parses source files into ASTs using tree-sitter grammars, which provide robust parsing even for incomplete or syntactically invalid code (common during active development). ASTs enable extraction of structural information: module boundaries, class hierarchies, function signatures, import/export relationships. This structural graph forms the backbone of codebase navigation and impact analysis.

**Stage 3: Semantic Enrichment** builds abstract syntax trees and performs name resolution to understand symbol references across files. For statically-typed languages, type information enriches this understanding; for dynamic languages, type inference and heuristic analysis approximate similar insights. The semantic graph connects definitions to uses, enabling agents to assess impact of proposed changes and identify relevant context for generation tasks.

**Stage 4: Convention Learning** analyzes existing code to infer implicit conventions: naming patterns, architectural patterns, testing practices, documentation standards. OpenKode's convention learning module encodes these as soft constraints that guide code generation toward stylistic consistency. This includes preferred import ordering, test file organization, error handling patterns, logging conventions, and API design patterns.

**Stage 5: Embedding Generation** produces vector representations for natural language search and similarity matching. These embeddings enable semantic similarity search—finding code similar to a described intent, identifying analogous patterns across the codebase, and retrieving relevant examples for few-shot prompting. The embedding cache is incrementally maintained, updating only changed entities rather than recomputing from scratch.

The ingestion pipeline produces a **queryable codebase model** that specifications reference through symbolic names rather than file paths. When a specification mentions "the user authentication service," OpenKode resolves this to the actual implementation files, interfaces, and tests—enabling specifications to remain valid as code is refactored and reorganized.

#### 1.3.2 AST-Based Code Understanding Module

The AST-based understanding module provides the foundation for intelligent code manipulation. Unlike text-based approaches that treat code as strings, **AST manipulation preserves syntactic validity and semantic relationships**, enabling transformations that would be fragile with regular expressions or template substitution.

| Operation | Description | Application |
|-----------|-------------|-------------|
| `locate(symbol)` | Find all definitions and uses of a named symbol | Impact analysis, refactoring targets |
| `extract_context(symbol, depth)` | Build dependency graph to specified depth | Context window assembly for agents |
| `suggest_insertion_point(spec)` | Identify optimal location for new code | Code generation placement |
| `generate_edit(transform)` | Produce syntactically valid code modification | Automated refactoring, specification implementation |
| `verify_invariant(invariant)` | Check that transformation preserves specified properties | Regression prevention |
| `semantic_diff(before, after)` | Identify meaning-preserving vs. meaning-changing modifications | Change validation |

The module implements **semantic diff computation**: given two ASTs, identify the minimal set of structural changes that transform one into the other. Unlike line-based diffing, semantic diff understands that reordering independent import statements is semantically neutral, that renaming a variable consistently across its scope is a single refactoring operation, and that extracting a function preserves behavior while changing structure. This understanding enables meaningful presentation of agent-generated changes and accurate assessment of modification scope.

**Scope analysis** identifies the visibility and lifetime of symbols, critical for safe code insertion. When an agent generates a new function, the module determines which imports must be added, which existing symbols might shadow or be shadowed, and where in the file structure the function should be placed for appropriate visibility. This analysis prevents common errors like reference to undefined variables or unintended capture of outer scope variables.

The module integrates with tree-sitter's **incremental parsing** for performance. As developers edit code, only changed regions are reparsed, maintaining sub-100ms response for interactive features. The module exposes both synchronous APIs for CLI operations and asynchronous streaming APIs for real-time UI updates.

For **multi-language codebases**, the AST module maintains separate grammars with cross-language reference resolution where applicable (e.g., TypeScript/JavaScript interop, Python/C extensions). This enables specifications that span language boundaries—"add a new API endpoint in Python with corresponding TypeScript client generation."

#### 1.3.3 Incremental Adoption Strategy

OpenKode is designed for **incremental adoption in existing codebases**, recognizing that wholesale migration to new development practices is impractical. The adoption strategy proceeds through four phases:

| Phase | Duration | Activities | Integration Depth |
|-------|----------|------------|-------------------|
| **1. Specification Documentation** | Week 1-2 | Write specs for features developed anyway, without AI execution | Observation only |
| **2. Assisted Planning** | Week 3-4 | AI generates specs from intent, human reviews before manual implementation | Planning assistance |
| **3. Selective Execution** | Week 5-8 | AI execution for well-understood, low-risk tasks with human review | Selective automation |
| **4. Full Integration** | Week 9+ | Specifications as primary interface, AI execution as default | Full orchestration |

**Phase 1: Specification Documentation** teams begin by writing specifications for features they would develop anyway, without using AI execution. This builds specification-writing skills and validates that specifications capture intent effectively. Specifications are stored alongside code, reviewed in pull requests, and refined based on implementation experience.

**Phase 2: Assisted Planning** introduces OpenKode's planning engine generating specifications from intent descriptions, which developers review and modify before manual implementation. This introduces AI assistance without surrendering control, allowing teams to calibrate the engine's output against their standards.

**Phase 3: Selective Execution** enables AI execution for well-understood, low-risk tasks (utility functions, boilerplate reduction, test generation). Each execution is reviewed, with feedback improving both the specification and OpenKode's understanding of codebase conventions. Verification automation catches regressions, and the specification library becomes institutional knowledge capturing design decisions and constraints.

**Phase 4: Full Integration** establishes specifications as the primary interface for feature development, with AI execution as default and human intervention for complex or critical changes. This phased approach manages risk while building organizational capability. Teams can pause or regress to earlier phases if quality concerns emerge, and different subsystems can advance at different paces based on criticality and test coverage.

## 2. Functional Requirements Specification

### 2.1 Specification Management System

#### 2.1.1 Natural Language Intent Capture

The entry point to OpenKode is **natural language intent capture**, where developers describe desired changes in conversational terms. This interface must balance expressiveness—accommodating vague, incomplete, or ambiguous descriptions—with structure—producing actionable specifications.

The intent capture system implements **progressive clarification**: initial description triggers elicitation questions that surface implicit constraints, edge cases, and "invisible rules" known to experienced developers but rarely explicitly documented. For example, given "add user search," OpenKode might ask: "Should search be case-sensitive? Should it support partial matches? What fields are searchable? Are there privacy considerations for user data exposure? What performance requirements exist for result latency?"

Elicitation is **context-aware**, drawing on codebase analysis to suggest relevant considerations. In a codebase with existing search implementations, OpenKode asks about consistency with established patterns. In codebases with performance-sensitive paths, it probes latency requirements. This two-sided dialogue collapses ambiguity into explicit decisions, producing specifications that capture intent clearly rather than leaving gaps for later inference.

The intent capture interface supports **multiple input modes**: interactive REPL conversation, structured form with field validation, and file-based batch submission for automated workflows. All modes produce the same internal representation, enabling seamless transition between interactive and programmatic use. Template suggestion accelerates specification by presenting relevant starting points based on project context—detected framework, existing similar specifications, current development phase.

#### 2.1.2 Structured Specification Schema (JSON/YAML)

Specifications are stored in a **structured schema** that balances human editability with machine processability. The schema supports both JSON (for programmatic generation) and YAML (for human authoring) serialization, with strict validation through Pydantic models.

```yaml
spec_version: "1.0"
spec_id: "user-search-enhancement-2024-03"
title: "Enhanced User Search with Fuzzy Matching"
description: "Add fuzzy search capability to user directory with performance optimization for large datasets"

intent:
  original: "Make user search better at finding people even with typos"
  clarified: "Implement fuzzy string matching for user name search with sub-100ms response for 100k users"

context:
  codebase_version: "abc123def"
  relevant_files:
    - path: "src/services/user_search.py"
      role: "primary_implementation"
    - path: "src/models/user.py"
      role: "data_model"
  conventions:
    - "prefer_levenshtein_distance"
    - "cache_expensive_computations"

tasks:
  - task_id: "T1"
    title: "Implement fuzzy matching algorithm"
    description: "Add Levenshtein distance calculation with early termination optimization"
    acceptance_criteria:
      - "Handles edit distance up to 3 for names under 20 characters"
      - "Performance: <10ms per comparison on benchmark hardware"
    dependencies: []
    estimated_tokens: 5000

  - task_id: "T2"
    title: "Integrate with existing search API"
    description: "Modify UserSearchService to use fuzzy matching when exact match fails"
    acceptance_criteria:
      - "Maintains backward compatibility with exact search parameter"
      - "Returns results sorted by relevance score"
    dependencies: ["T1"]
    estimated_tokens: 3000

verification:
  static_checks:
    - "mypy --strict src/services/"
    - "ruff check src/services/user_search.py"
  test_requirements:
    - "Unit tests for distance calculation edge cases"
    - "Integration tests for API contract preservation"
  performance_benchmarks:
    - name: "100k_user_search"
      target_p99_ms: 100

metadata:
  author: "developer@example.com"
  created_at: "2024-03-15T09:23:00Z"
  priority: "high"
  estimated_effort: "2 days"
```

This schema enables: **version-controlled specification evolution**, automated validation of completeness, dependency-based task scheduling, and traceability from intent through implementation to verification. The `context` section links to relevant codebase entities, ensuring agents always work with current context even as code evolves.

#### 2.1.3 Specification Versioning and Dependency Tracking

Specifications evolve as understanding deepens and requirements change. OpenKode implements **Git-native versioning** where specifications live in repository `.openkode/specs/` with full history. Specification changes trigger the same review processes as code changes, with pull request integration showing impact analysis—what tasks are affected, what code would need regeneration, what tests require updates.

| Version Component | Change Type | Example |
|-------------------|-------------|---------|
| **Patch** | Clarifications without intent change | Fix typo in acceptance criterion |
| **Minor** | Scope additions, backward compatible | Add new acceptance criterion |
| **Major** | Fundamental redefinition, breaking changes | Change from fuzzy to semantic search |

**Dependency tracking** operates at multiple levels: between specifications (epic decomposition into stories), between tasks within a specification, and between specifications and code (which files implement which requirements). This graph enables impact analysis—when a specification changes, OpenKode identifies all downstream artifacts requiring attention.

The dependency system also tracks **external dependencies**: API versions, library compatibility, infrastructure requirements. A specification might declare `requires: postgres>=14, redis>=6` enabling environment validation before execution attempt. When a depended-upon specification changes, dependent specifications are marked for review—implementation may remain valid, but verification is required.

#### 2.1.4 Specification-to-Task Decomposition Engine

Complex specifications require decomposition into manageable tasks that can be independently implemented and verified. The decomposition engine analyzes specification structure, codebase organization, and task dependencies to produce optimal task breakdowns.

| Decomposition Strategy | Criteria | Example |
|------------------------|----------|---------|
| **Layer separation** | Clear architectural boundaries | Database layer → API layer → Frontend layer |
| **Component isolation** | Minimal interface between parts | Authentication service independent from user profile service |
| **Data flow division** | Sequential processing stages | Input validation → Business logic → Persistence → Response formatting |
| **Risk stratification** | Uncertainty and criticality variation | Core algorithm (high scrutiny) + Boilerplate integration (automated) |

The engine estimates **token requirements and complexity** for each task, enabling intelligent batching and agent assignment. Tasks below a token threshold might be combined for efficiency; tasks exceeding context window limits are further decomposed. Task granularity represents a critical optimization parameter, with overly fine decomposition incurring coordination overhead and overly coarse decomposition limiting parallelism and obscuring progress visibility.

Each generated task encapsulates **sufficient context for independent execution** while maintaining references to shared resources that require coordination. The task structure includes: input artifacts, expected outputs, execution environment requirements, timeout policies, and retry configurations. Tasks are annotated with estimated token consumption and API cost, enabling budget-aware scheduling and early warning of potentially expensive operations.

### 2.2 AI Agent Integration Layer

#### 2.2.1 Pluggable Agent Interface (OpenAI, Anthropic, Local Models)

OpenKode's agent integration layer abstracts over diverse AI providers through a **unified interface**, enabling seamless switching and fallback without specification changes. The interface defines:

| Method | Purpose | Return Type |
|--------|---------|-------------|
| `generate(specification, context, options)` | Primary generation method | `GenerationResult` with text, usage, metadata |
| `stream_generate(specification, context, options)` | Real-time output for UI | `AsyncIterator[Token]` |
| `estimate_tokens(specification, context)` | Cost and context planning | `TokenEstimate` with prompt/completion breakdown |
| `validate_connection()` | Health check and capability detection | `ConnectionStatus` with model info, limits |

Provider implementations handle provider-specific concerns: API authentication, rate limit compliance, response parsing, error classification. The interface normalizes across differences in streaming protocols, function calling conventions, and structured output formats.

| Provider | Models | Special Features | Best For |
|----------|--------|------------------|----------|
| **OpenAI** | GPT-4, GPT-4-turbo, GPT-3.5-turbo | Function calling, JSON mode, fine-tuning | General coding, structured output |
| **Anthropic** | Claude 3 Opus, Sonnet, Haiku | Extended context (200k), artifact generation | Long-context reasoning, planning |
| **Local (llama.cpp)** | Llama 3, CodeLlama, Mistral | Privacy, offline operation, cost control | Sensitive code, air-gapped environments |
| **Local (vLLM)** | Same as above | Batching, throughput optimization | High-volume, latency-sensitive |
| **Azure OpenAI** | GPT-4, GPT-3.5 | Enterprise compliance, regional deployment | Regulated industries, data residency |

#### 2.2.2 Context Window Management and Token Optimization

Modern LLMs operate within finite context windows, making **efficient context utilization** critical for specification-driven development. OpenKode implements sophisticated context management:

**Hierarchical Context Assembly**: Context is assembled in priority order: (1) specification and current task (10-20% of budget), (2) directly relevant code—definitions of symbols being modified (60-70% of budget), (3) indirectly relevant code—callers, callees, related modules (remaining budget), (4) codebase conventions and patterns, (5) examples of similar changes. Each level is included only if space permits, with intelligent truncation that preserves structural boundaries.

**Semantic Compression**: For large code regions, OpenKode generates summaries that capture essential interface contracts while omitting implementation details. A 500-line module might be compressed to "Exports: `UserService` (class) with methods `find_by_id`, `search`, `create`; Depends on: `DatabaseConnection`, `EventBus`; Key invariants: all methods validate permissions, all writes emit events."

**Incremental Context Updates**: During extended generation sessions, only changed context is transmitted, with the model maintaining state across turns. This reduces per-request token consumption and improves coherence for multi-file changes.

| Optimization Technique | Token Savings | Implementation Complexity |
|------------------------|-------------|---------------------------|
| Hierarchical assembly | 30-50% | Low—priority queue |
| Semantic compression | 40-70% for large files | Medium—summarization model |
| Incremental updates | 20-40% for multi-turn | Low—diff-based transmission |
| Embedding-based retrieval | 50-80% for targeted context | Medium—vector index maintenance |
| Caching common prefixes | 10-20% | Low—simple memoization |

#### 2.2.3 Multi-Model Fallback and Routing

Production reliability requires **graceful degradation** when primary models are unavailable or overwhelmed. OpenKode's routing system implements:

| Routing Strategy | Mechanism | Trigger |
|------------------|-----------|---------|
| **Health-aware routing** | Continuous monitoring of latency/error rates | Automatic failover to backup providers |
| **Capability-based routing** | Tasks requiring extended context → Claude; function calling → GPT-4 | Per-task requirement analysis |
| **Cost-optimized routing** | Budget constraints trigger model downgrading with quality monitoring | Cost threshold breach |
| **Local-first routing** | Sensitive codebases configure local models as primary | Privacy/cost configuration |

**Quality monitoring** tracks output quality metrics—verification pass rates, human acceptance rates, iteration counts—to detect degradation that might indicate model inadequacy for specific tasks. Persistent degradation triggers routing rule updates, directing similar future tasks to better-performing alternatives.

**Circuit breaker patterns** prevent cascade failures when providers experience widespread issues. After configurable failure threshold, the circuit opens, directing all traffic to alternatives until health checks pass. This ensures that temporary provider issues don't cascade into complete system unavailability.

### 2.3 Code Generation and Execution

#### 2.3.1 Template-Based Code Synthesis

While AI agents generate novel code for unique requirements, **repetitive patterns benefit from template-based synthesis**. OpenKode's template engine combines static templates with AI-powered slot filling:

```python
# Template: FastAPI endpoint with CRUD operations
TEMPLATE = """
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/{{entity_plural}}", tags=["{{entity_plural}}"])

@router.post("/", response_model={{Entity}}Response)
def create_{{entity}}(
    {{entity}}: {{Entity}}Create,
    db: Session = Depends(get_db)
):
    \"\"\"Create a new {{entity}}.\"\"\"
    {{#ai_slot:implementation}}
    # AI generates: validation, database operation, error handling, response
    {{/ai_slot}}
    ...
"""
```

Templates capture **codebase-specific patterns** while AI fills implementation details that vary by context. This hybrid approach improves consistency and reduces token consumption for common operations. Template application involves **slot filling**—replacing template variables with context-appropriate values—and **adaptation**—modifying template structure to fit specific requirements.

**Template learning** extracts patterns from existing codebase, identifying repeated structures that might benefit from templatization. Suggested templates are presented for human curation, with usage statistics guiding prioritization. Over time, **project-specific template libraries** emerge that capture team conventions more precisely than generic alternatives.

#### 2.3.2 Multi-File Coordination and Dependency Resolution

Real features span multiple files with interdependencies. OpenKode's **coordination engine** determines optimal generation order: interfaces before implementations, schemas before validators, migrations before model changes. The engine detects circular dependencies and proposes resolution strategies—temporary stub generation, interface extraction, or specification refinement.

| Coordination Challenge | Resolution Strategy | Implementation |
|------------------------|---------------------|----------------|
| Interface/implementation ordering | Topological sort with forward declaration injection | DAG-based scheduling |
| Circular type dependencies | Break with `TYPE_CHECKING` imports or protocol extraction | AST-based refactoring suggestions |
| Cross-language references | Language-server coordination with unified symbol resolution | Multi-parser integration |
| Test co-generation | Parallel generation with verification coupling | Test-oracle synchronization |

During generation, the engine maintains a **pending changes buffer** that allows preview and rollback before filesystem modification. Developers can review the complete proposed change across all files, accept selectively, or request regeneration with modified specifications. **Atomic presentation** presents multi-file changes as coherent units rather than isolated modifications, with navigation between related changes and understanding of motivation for each modification.

#### 2.3.3 Sandbox Execution Environment

Generated code executes in **isolated environments** for testing and verification. OpenKode supports multiple sandbox technologies:

| Sandbox | Isolation Level | Startup Latency | Use Case |
|---------|---------------|---------------|----------|
| **Python venv** | Process + filesystem | ~100ms | Unit tests, linting |
| **Docker container** | OS-level | ~500ms | Integration tests, service simulation |
| **Firecracker microVM** | Hardware-virtualized | ~150ms | Untrusted code, security-critical |
| **WebAssembly** | Capability-based | ~10ms | Deterministic, portable execution |

Sandbox configuration is **specification-driven**—tests declare their requirements (database, network, GPU), and the execution environment provisions accordingly. **Network policy** determines sandbox network access: most verification requires no external network; dependencies are pre-fetched and cached. When network is required, access is through explicit allowlists with monitoring and logging.

**Secret management** ensures that sandboxed code cannot access production credentials. Test-specific credentials are injected for verification; production secrets are inaccessible by construction. This separation is verified through static analysis and runtime monitoring.

### 2.4 Verification and Quality Assurance

#### 2.4.1 Static Analysis Integration

OpenKode integrates multiple static analysis tools as **verification plugins**:

| Tool Category | Python Ecosystem | JavaScript/TypeScript | Purpose |
|-------------|----------------|----------------------|---------|
| **Syntax validation** | `ast`, `tree-sitter` | `typescript` compiler | Catch generation errors before execution |
| **Type checking** | `mypy`, `pyright` | `tsc`, `eslint` | Verify type correctness |
| **Style enforcement** | `ruff`, `black` | `eslint`, `prettier` | Ensure consistency with conventions |
| **Security scanning** | `bandit`, `semgrep` | `eslint-security`, `semgrep` | Detect common vulnerabilities |
| **Complexity analysis** | `radon`, `cognitive-complexity` | `eslint-complexity` | Flag unmaintainable code |

Analysis results are **normalized to a common format** with severity classification, location attribution, and fix suggestions where available. **Deduplication** across analyzers prevents noise from overlapping detections. Results feed into **issue aggregation**, presented with severity-appropriate handling: cosmetic changes auto-approved; pure refactorings auto-approved after equivalence verification; behavioral changes require human review with highlighted specification relevance.

#### 2.4.2 Automated Test Generation and Execution

Specifications include **acceptance criteria that drive test generation**. OpenKode generates: unit tests for isolated functions with boundary value analysis; integration tests for component interaction; property-based tests for invariant verification; and contract tests for API boundaries.

| Test Type | Generation Method | Oracle Strategy |
|-----------|-------------------|---------------|
| **Unit tests** | Boundary value analysis, equivalence partitioning | Explicit from acceptance criteria |
| **Integration tests** | Scenario extraction from specification | Expected output from specification examples |
| **Property-based** | `hypothesis` or similar framework | Invariants: no exceptions, consistency preservation |
| **Contract tests** | API schema inference | Round-trip verification, schema validation |

Generated tests execute in sandboxed environments with **coverage tracking**. Coverage gaps—specification criteria without corresponding test verification—are flagged for human review, ensuring that specifications drive test completeness rather than arbitrary coverage targets. **Flaky test detection** monitors result stability across repeated executions, flagging tests that exhibit non-deterministic behavior for investigation and stabilization.

#### 2.4.3 Semantic Diff and Change Validation

Beyond textual diff, OpenKode performs **semantic diff** that understands code meaning:

| Diff Type | Detection | Example |
|-----------|-----------|---------|
| **API contract change** | Signature modification with external callers | Function parameter added without default |
| **Behavior preservation** | Equivalent transformation verification | Refactoring maintains output for all inputs |
| **Performance regression** | Complexity change or resource pattern shift | O(n) to O(n²) algorithm change |
| **Security surface change** | New trust boundary or data exposure | Previously internal function now exported |

Semantic diff enables **confident refactoring**—developers approve transformations verified to preserve semantics while flagging changes requiring additional scrutiny. **Change classification** categorizes modifications by risk level: cosmetic changes auto-approved; pure refactorings auto-approved after equivalence verification; behavioral changes require human review; security-sensitive changes require specialized review regardless of apparent simplicity.

## 3. User Interface and Experience Design

### 3.1 Interface Paradigm: Terminal-First with Rich Visuals

#### 3.1.1 Three-Pane Layout Architecture

The three-pane layout directly adapts proven IDE patterns from VS Code, optimizing for terminal constraints while preserving cognitive efficiency of spatial organization.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  HEADER: Project: openkode-core  │  Agent: claude-sonnet-4  │  🟢 Healthy   │
├──────────┬──────────────────────────────────────────────┬───────────────────┤
│          │                                              │                   │
│  LEFT    │              CENTER                          │     RIGHT         │
│  SIDEBAR │              PANEL                           │     SIDEBAR       │
│          │                                              │                   │
│  📋 Spec │  ┌────────────────────────────────────────┐  │  🔍 Verification  │
│  Tree    │  │  Code Editor with Syntax Highlighting  │  │  Results          │
│          │  │  (Active: src/core/spec_manager.py)    │  │                   │
│  ├── EP-1│  │                                        │  │  ⚠️ 3 Warnings    │
│  │   ├──│  │  def create_spec(                      │  │  ✅ 12 Passed     │
│  │   └──│  │      intent: str,                      │  │  ❌ 1 Failed      │
│  ├── EP-2│  │      context: CodebaseContext          │  │                   │
│  └── ... │  │  ) -> Specification:                   │  │  📊 Coverage: 87% │
│          │  │      """Create specification from      │  │                   │
│  🎯 Task │  │       natural language intent."""      │  │  📝 Agent Output  │
│  Queue   │  │      # Implementation here...          │  │  ───────────────  │
│          │  │                                        │  │  Planning task    │
│  [====>  │  │                                        │  │  decomposition... │
│   67%]   │  │                                        │  │  [Streaming...]   │
│          │  └────────────────────────────────────────┘  │                   │
│          │                                              │                   │
│  🔧 Quick│  ┌────────────────────────────────────────┐  │  🕐 System Logs   │
│  Actions │  │  AI Collaboration Panel                │  │  ───────────────  │
│          │  │  > Generate implementation for         │  │  14:32:01 Spec    │
│  [Plan]  │  │    create_spec with error handling     │  │       created     │
│  [Exec]  │  │                                        │  │  14:32:15 Tasks   │
│  [Rev]   │  │  [Accept] [Modify] [Reject] [Explain]  │  │       generated   │
│  [Debug] │  │                                        │  │  14:32:45 Agent   │
│          │  └────────────────────────────────────────┘  │       started     │
├──────────┴──────────────────────────────────────────────┴───────────────────┤
│  STATUS: Current: EP-7.3 "Add rollback support"  │  Tokens: 12.4k/200k    │
└─────────────────────────────────────────────────────────────────────────────┘
```

##### 3.1.1.1 Left Sidebar: Specification Hierarchy and Task Navigation

The left sidebar provides **persistent access to the specification tree and task queue**. The specification tree displays epics and their child specifications with visual indicators for status (draft, approved, in-progress, verified, failed). **Drag-and-drop reordering** enables priority adjustment, while context menus provide quick actions (create child, duplicate, archive). The tree supports **keyboard navigation**—arrow keys for movement, enter for expansion/collapse, space for selection—with search filtering that narrows visible nodes based on text match.

The **task queue** shows currently executing and pending tasks with progress indicators. Each task displays: specification reference, task type (codegen, test, verify), assigned agent, and estimated completion. Clicking a task navigates to relevant code and displays full task context in the AI collaboration panel.

##### 3.1.1.2 Center Panel: Code Editor with Inline AI Collaboration

The center panel combines **traditional code editing with AI collaboration features**. The editor supports: syntax highlighting for all supported languages, real-time error squiggles from integrated static analysis, and **inline diff visualization** for AI-suggested changes. Generated code appears with subtle background differentiation and generation metadata (timestamp, generating agent, confidence score). Hover or focus reveals the specification fragment that motivated the generation, enabling traceability from implementation back to intent.

The **AI collaboration panel** (bottom portion of center) displays agent output with structured interaction: streaming responses with syntax-highlighted code blocks, action buttons for common responses (accept, reject, request modification, request explanation), and conversation history for context restoration. **"Thinking trace"** feature exposes the AI's reasoning process for significant decisions—alternative options considered and evaluation criteria applied.

##### 3.1.1.3 Right Sidebar: Verification Results and System Logs

The right sidebar splits between **verification status** (top) and **system activity** (bottom). Verification results aggregate across all active verifications with severity-based filtering. Each result links to relevant code location and provides one-click navigation. System logs provide operational visibility: agent API calls with latency and token usage, filesystem operations, git operations, and error conditions with stack traces.

#### 3.1.2 Keyboard-Centric Interaction Model

OpenKode's interaction design **explicitly prioritizes keyboard efficiency**, with all core operations accessible without mouse movement. The interaction model follows **modal editing** inspired by Vim, with distinct modes for: **Normal** (navigation and command), **Insert** (text entry), **Visual** (selection), **Command** (ex-style commands), and **Specification** (specification-focused operations).

| Shortcut | Action | Context |
|----------|--------|---------|
| `Ctrl+Shift+O` | Open specification quick picker | Global |
| `Ctrl+Shift+T` | Create new specification from template | Global |
| `Ctrl+Shift+A` | Trigger AI action on current context | Editor focused |
| `Ctrl+Shift+V` | Toggle verification panel | Global |
| `Ctrl+Shift+L` | Focus system logs | Global |
| `Ctrl+K Ctrl+S` | Save specification and trigger planning | Specification editor |
| `Ctrl+K Ctrl+E` | Execute current task with agent | Task selected |
| `Ctrl+K Ctrl+R` | Request review of current implementation | Editor focused |
| `F5` | Refresh codebase analysis | Global |
| `Ctrl+Shift+P` | Command palette (all actions) | Global |

**Leader key sequences** (`Space` or `,` as configurable prefix) provide access to command palettes organized by functional area: `<leader>s` for specification operations, `<leader>a` for agent control, `<leader>v` for verification, `<leader>g` for generation, `<leader>w` for window management. **Which-key style prompts** display available commands after leader key delay, aiding discoverability without documentation consultation.

#### 3.1.3 Contextual Command Palette

The command palette extends beyond simple command execution to provide **contextually-aware operation suggestions** based on current selection, active specification, and system state. When a specification phase is selected, palette prioritizes phase-specific operations (execute, verify, skip, rollback); when code is displayed, code-specific operations (refactor, explain, test) surface prominently.

**Contextual suggestions** incorporate learned patterns from user history, anticipating likely next actions based on current state and past behavior. These predictions appear as prominent suggestions that can be accepted with minimal keystrokes, accelerating routine workflows while preserving access to full operation set for novel situations. The learning system respects privacy through **local-only processing**, with optional anonymized contribution to global pattern improvement.

### 3.2 Visual Design System

#### 3.2.1 Color Palette: Dark Mode Optimized for Extended Use

OpenKode's default theme is **dark mode**, optimized for reduced eye strain during extended development sessions. The palette uses **semantic color assignment**:

| Semantic Role | Color | Hex | Usage |
|-------------|-------|-----|-------|
| Background primary | Deep slate | `#0d1117` | Main editor, panels |
| Background secondary | Slate | `#161b22` | Sidebars, inactive regions |
| Background tertiary | Light slate | `#21262d` | Hover states, selections |
| Text primary | Off-white | `#c9d1d9` | Primary content |
| Text secondary | Slate gray | `#8b949e` | Secondary information |
| Accent success | Emerald | `#238636` | Success, completion, passing tests |
| Accent warning | Amber | `#d29922` | Warnings, attention needed |
| Accent error | Rose | `#da3633` | Errors, failures, blocking issues |
| Accent info | Sky | `#58a6ff` | Information, active processes |
| Accent agent | Violet | `#a371f7` | AI-generated content, agent activity |

Colors maintain **WCAG AA contrast ratios** (4.5:1 for normal text, 3:1 for large text) ensuring accessibility. The palette is **themeable** through CSS-influenced configuration for organizational branding or personal preference.

#### 3.2.2 Typography: Monospace Hierarchy for Code and UI

Typography establishes clear hierarchy while maintaining the **monospace aesthetic essential for code-centric tools**:

| Level | Font | Size | Weight | Usage |
|-------|------|------|--------|-------|
| UI heading | System sans | 16px | 600 | Panel titles, section headers |
| UI body | System sans | 14px | 400 | Labels, descriptions, navigation |
| Code primary | JetBrains Mono | 14px | 400 | Editor content, primary code |
| Code secondary | JetBrains Mono | 12px | 400 | Line numbers, minimap, inline annotations |
| Code comment | JetBrains Mono | 14px | 400 (italic) | Comments, documentation |
| Specification | JetBrains Mono | 14px | 500 | Specification titles, task names |

Font features enable code clarity: **ligatures** for common operators (`!=`, `=>`), **stylistic sets** for zero/o and one/l distinction, and **proportional numbers** for line numbering.

#### 3.2.3 Iconography: Minimal, Semantic, ASCII-Friendly Fallbacks

Icons enhance recognition without requiring color vision. OpenKode uses a **hybrid approach**:

| Icon | Meaning | ASCII Fallback |
|------|---------|--------------|
| `●` | Success/Complete | `[OK]` |
| `○` | Pending | `[..]` |
| `◐` | In Progress | `[>]` |
| `▲` | Warning | `[!]` |
| `✗` | Error | `[FAIL]` |
| `ℹ` | Information | `[i]` |
| `?` | Question/Help | `[?]` |
| `+` | Add/Create | `[+]` |
| `-` | Delete/Remove | `[-]` |
| `✎` | Edit/Modify | `[E]` |

**Primary**: 16×16 pixel-perfect icons from a custom set designed for terminal resolution constraints. **Fallback**: ASCII/Unicode equivalents for terminals without image support. Icons are **semantically tagged** for screen reader announcement and maintain consistent meaning across contexts.

### 3.3 Interaction Patterns

#### 3.3.1 Progressive Disclosure of Complexity

OpenKode manages complexity through **progressive disclosure**, presenting essential information by default with optional depth expansion:

| Complexity Level | Default Display | Expansion Trigger |
|----------------|---------------|-----------------|
| Minimal | Task status, file count, overall progress | Always visible |
| Summary | Task titles, key metrics, warning count | Hover or focus |
| Detailed | Full specification, verification breakdown | Click or key command |
| Complete | Raw agent output, AST dumps, timing traces | Debug mode or explicit request |

This pattern prevents information overload while ensuring detailed information remains accessible for debugging and optimization. **Smart defaults** infer appropriate disclosure based on activity context: active specifications automatically expand to show current phase, failed specifications expand to reveal error details, newly created specifications expand to guide initial configuration.

#### 3.3.2 Real-Time Feedback Loops

Long-running operations provide **continuous feedback** to maintain developer engagement and enable early intervention:

| Operation Phase | Feedback Mechanism | Intervention Point |
|-----------------|-------------------|-------------------|
| Planning | Streaming analysis phases | Cancel and refine intent |
| Context loading | File discovery progress | Adjust scope if too broad |
| Generation | Live code with syntax highlighting | Pause, modify, or redirect |
| Verification | Progressive result aggregation | Early issue triage |

**Streaming output** from agent operations appears in dedicated panels that update continuously, with **scroll behavior** that follows new content by default while preserving manual scroll override for review of earlier output. **Rate limiting** prevents display flooding from verbose agents, with aggregation of rapid successive updates and expansion controls for detailed examination.

#### 3.3.3 Undo/Redo at Specification and Code Levels

Comprehensive **undo/redo** spans both specification and code domains:

| Undo Scope | Granularity | Persistence |
|-----------|-------------|-------------|
| Specification edit | Individual field changes | Session + Git history |
| Task reordering | Single move operation | Session |
| Code generation | Per-file or per-task | Git staging area |
| Verification fix | Individual fix application | Git staging area |
| UI state | Panel layout, filter settings | User preferences |

Undo history is **visualized as a branching timeline**, showing where human edits, AI generations, and automated fixes diverged. Developers can navigate to any point and create alternative branches—exploring multiple implementation approaches without losing work.

### 3.4 Accessibility and Developer Ergonomics

#### 3.4.1 Screen Reader Compatibility for Terminal UI

Terminal applications traditionally present accessibility challenges. OpenKode addresses this through:

| Technique | Implementation | Benefit |
|-----------|---------------|---------|
| Semantic markup | Rich text regions tagged with ARIA-equivalent roles | Screen reader navigation |
| Focus management | Clear focus indicators, logical tab order | Keyboard-only operation |
| Alternative output | Structured text mode for linear consumption | Non-visual access |
| Audio cues | Optional sound feedback for status changes | Multi-modal notification |

The **screen reader mode** can be enabled persistently or toggled dynamically, with state synchronized across sessions. **Landmark announcements** on major context changes maintain orientation without visual reference.

#### 3.4.2 Configurable Keybinding Schemes

OpenKode ships with **multiple keybinding presets** and full customization:

| Preset | Based On | Best For |
|--------|----------|----------|
| Default | OpenKode native | New users, consistent experience |
| Vim | Vim editor | Modal editing enthusiasts |
| Emacs | GNU Emacs | Emacs users, extensive chord sequences |
| VS Code | Visual Studio Code | IDE migrants, muscle memory preservation |
| IntelliJ | JetBrains IDEs | Java/Kotlin developers |

**Custom keybindings** are defined in YAML with context scoping—different bindings can apply in editor vs. navigation contexts. **Conflict detection** warns of overlapping assignments with resolution suggestions.

#### 3.4.3 Session Persistence and Recovery

Developer state is **continuously persisted** to enable recovery from crashes, system restarts, or context switching:

| Persisted State | Capture Mechanism | Recovery Option |
|-----------------|-------------------|---------------|
| Open specifications and tasks | Immediate on change | Exact position restoration |
| In-progress operations | Checkpointing | Resume or restart from checkpoint |
| UI configuration | Periodic + on change | Layout and preference restoration |
| Command history | Continuous | Searchable across sessions |

Recovery on launch presents options: **resume exact state**, **resume with clean verification status**, or **start fresh**. This respects both continuity needs and the desire for clean starts after significant time away.

## 4. Wireframe Specifications

### 4.1 Main Application Layout

#### 4.1.1 Header Bar: Project Context, Agent Status, System Health

The header bar (fixed height: 2 lines) provides **persistent context**:

```
┌─ OpenKode: myproject ──────────────────────────────────────────────┐
│ [●] Planning: user-auth-refactor  |  Agent: Claude 3 Opus  |  ✓ 12 ✗ 0 │
│ ~/projects/myproject  |  Branch: feature/auth  |  847 specs  |  ⏱ 2.3k tok/s │
└─────────────────────────────────────────────────────────────────────┘
```

| Element | Display | Interaction |
|---------|---------|-------------|
| Project name | Click to switch recent projects | Dropdown with recent + search |
| Current operation | Animated indicator during active work | Click for detailed progress |
| Agent status | Current model, connection health | Click for model selection |
| Verification summary | Passing/failing count | Click for detailed results |
| Repository context | Path, branch, specification count | Click for git operations |
| Performance metrics | Token throughput, latency | Click for historical trends |

#### 4.1.2 Activity Bar: Mode Switching (Plan/Execute/Review/Debug)

The activity bar provides **primary mode navigation**:

| Mode | Indicator | Active Color | Description |
|------|-----------|------------|-------------|
| Plan | `P` | Blue | Specification creation and refinement |
| Execute | `E` | Green | Agent invocation and code generation |
| Review | `R` | Yellow | Verification and quality assessment |
| Debug | `D` | Magenta | Issue investigation and resolution |

Mode selection **transforms the entire interface configuration**: sidebar content, center panel defaults, and available command palette options all adapt to mode-appropriate workflows. **Mode transitions** preserve context where possible, with state preservation enabling rapid context switching.

#### 4.1.3 Status Bar: Current Specification, Task Progress, Model Usage

The status bar (bottom, 1-2 lines) displays **operation-specific information**:

```
[user-search-enhancement] T2/4: Integrate with existing search API | ████████░░ 67%
Tokens: 4.2k/8k context | Cost: $0.023 | ETA: 45s
```

| State | Content | Update Frequency |
|-------|---------|------------------|
| Default | Current spec, position, file info | Immediate |
| Active operation | Progress, elapsed, ETA | Sub-second |
| Agent operation | Model, context usage, parameters | Streaming |
| Error state | Error count, first error, navigation | On event |

### 4.2 Specification Creation Flow

#### 4.2.1 Intent Input Modal with Template Suggestions

```
┌─────────────────────────────────────────────────────────────────────┐
│ New Specification                                                     │
│ ─────────────────────────────────────────────────────────────────── │
│ Describe what you want to build:                                      │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Add fuzzy search to user directory that handles typos and ranks   │ │
│ │ results by relevance                                               │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│ Suggested templates:                                                  │
│  [1] API endpoint with CRUD operations                               │
│  [2] Database migration with rollback                                │
│  [3] React component with state management                           │
│  [4] Background job with retry logic                                 │
│  [5] Custom (start from scratch)                                     │
│                                                                       │
│ [Continue →]  [Advanced options]  [Cancel]                           │
└─────────────────────────────────────────────────────────────────────┘
```

**Template selection** pre-populates specification structure while preserving intent focus. **Advanced options** expose context window size, agent selection, and verification strictness.

#### 4.2.2 Specification Preview with Editable Structure

```
┌─ Specification Preview ─────────────────────────────────────────────┐
│ Title: Enhanced User Search with Fuzzy Matching                      │
│ [Edit] [Regenerate] [Add task] [Adjust scope]                        │
│ ─────────────────────────────────────────────────────────────────── │
│ ▼ Tasks (4)                                                          │
│   ├─ T1: Implement fuzzy matching algorithm [✓ Ready]                │
│   │   Acceptance: <10ms per comparison, edit distance ≤3             │
│   │   [Modify] [Delete] [Add dependency]                             │
│   ├─ T2: Integrate with existing search API [⏳ Waiting: T1]         │
│   │   ...                                                            │
│   └─ ...                                                             │
│ ▶ Context (847 files analyzed, 12 relevant)                          │
│ ▶ Verification (static, test, performance requirements)              │
│                                                                       │
│ [✓ Accept and proceed to execution]  [✗ Reject and refine intent]   │
└─────────────────────────────────────────────────────────────────────┘
```

**Editable regions** expand inline, with validation preventing inconsistent modifications. The preview phase is designed for **deliberate review**—time invested in planning yields disproportionate quality improvements.

#### 4.2.3 Confirmation and Task Generation Animation

```
Generating tasks...
  [████████████████████] Analyzing dependencies
  [████████████████░░░░] Building execution graph  
  [████████████████████] Finalizing specifications

✓ 4 tasks created with 3 dependencies
✓ Estimated 12,400 tokens, $0.15-0.23 cost
✓ Ready for execution with Claude 3 Opus
```

Animation duration is calibrated to provide **satisfaction without impatience**—typically 500-1500ms depending on complexity. **Cancellation** is available until finalization completes.

### 4.3 Execution Monitoring Interface

#### 4.3.1 Real-Time Agent Output Streaming

```
┌─ Execution: T1 - Implement fuzzy matching algorithm ─────────────────┐
│ Agent: Claude 3 Opus | Tokens: 2.3k generated | Time: 45s            │
│ ─────────────────────────────────────────────────────────────────── │
│ ▶ Analyzing requirements...                                          │
│   Considering Levenshtein, Damerau-Levenshtein, and Jaro-Winkler    │
│   Selected: Levenshtein with early termination optimization          │
│                                                                       │
│ ▶ Generating implementation...                                       │
│   ┌─ src/utils/fuzzy_match.py ─────────────────────────────────────┐ │
│   │  1 | def levenshtein_distance(s1: str, s2: str, max_dist: int   │ │
│   │  2 |     """Calculate edit distance with early termination."""  │ │
│   │  3 |     # Implementation streaming... ████████████████████░░░  │ │
│   │    | ...                                                         │ │
│   └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│ [⏸ Pause] [⏹ Stop] [⚡ Speed: 1x]                                    │
└─────────────────────────────────────────────────────────────────────┘
```

**Streaming code** receives immediate syntax highlighting and **progressive validation** as it emerges.

#### 4.3.2 File Change Visualization (Tree Map + Diff)

```
┌─ Changes (5 files) ─────────────────────────────────────────────────┐
│ 📁 src/                                                              │
│ ├── 🆕 utils/fuzzy_match.py          [+127 lines]  [View Diff]       │
│ ├── 📝 services/user_search.py       [~15 lines]   [View Diff]       │
│ │   └── Modified: search() to call fuzzy fallback                   │
│ ├── 📝 models/search_result.py       [~8 lines]    [View Diff]       │
│ │   └── Added: relevance_score field                                │
│ └── 🗑️  old_fuzzy.py (deleted)       [-89 lines]   [View Diff]       │
│ 📁 tests/                                                            │
│ └── 🆕 test_fuzzy_match.py           [+156 lines]  [View Diff]       │
│                                                                       │
│ [Select All]  [Stage Selected]  [Request Changes]                    │
└─────────────────────────────────────────────────────────────────────┘
```

**Tree map** shows change magnitude and type; **drill-down** reveals detailed diff with acceptance controls.

#### 4.3.3 Checkpoint and Rollback Controls

```
┌─ Checkpoints for EP-7.3 ────────────────────────────────────────────┐
│ #  Timestamp         Description                    Status  Action   │
│ ───────────────────────────────────────────────────────────────────  │
│ 3  14:32:45          After task 5 complete          ✓ Valid [Rollback]│
│ 2  14:31:12          After task 3 (with fix)        ✓ Valid [Rollback]│
│ 1  14:28:03          Initial state                  ✓ Valid [Rollback]│
│ 0  14:27:30          Pre-execution                  ✓ Valid [Rollback]│
│                                                                       │
│ [Create Manual Checkpoint]  [Purge Old Checkpoints]                  │
│                                                                       │
│ ⚠️  Rolling back to checkpoint 2 will discard changes from tasks 4-5.│
│     Continue? [Confirm] [Cancel]                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Explicit checkpoint creation** at user-determined points enables named restoration states for experimental branches or significant milestones.

### 4.4 Review and Verification Dashboard

#### 4.4.1 Issue Aggregation by Severity and Category

```
┌─ Verification Results: EP-7.3 ──────────────────────────────────────┐
│ ❌ 1 Critical    ⚠️ 3 Warnings    ℹ️ 8 Informational    ✅ 12 Passed  │
│ Filter: [All ▼]  Sort: [Severity ▼]  Group: [Category ▼]             │
│ ───────────────────────────────────────────────────────────────────  │
│ ┌─ ❌ CRITICAL: Type mismatch in fuzzy_match.distance() ───────────┐ │
│ │    Expected: int, Actual: Optional[int]                           │ │
│ │    Location: src/utils/fuzzy_match.py:47                          │ │
│ │    [View Code]  [🔧 Fix with AI]  [Mark False Positive]           │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│ ┌─ ⚠️  WARNING: Missing docstring for levenshtein_distance ────────┐ │
│ │    Location: src/utils/fuzzy_match.py:12                          │ │
│ │    [View Code]  [🔧 Fix with AI]  [Ignore]                        │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│ [Export Report]  [Re-run Verification]  [Approve with Issues]        │
└─────────────────────────────────────────────────────────────────────┘
```

**Cross-analyzer deduplication** and **severity-appropriate handling** streamline triage workflow.

#### 4.4.2 Side-by-Side Expected vs. Actual Comparison

```
┌─ Specification Requirement ───────────┬─ Implementation ──────────────┐
│ "Rollback preserves specification     │ ❌ Current: Rollback restores │
│  integrity"                           │    files but loses spec       │
│                                       │    reference linkage          │
│ Acceptance Criterion:                 │                               │
│ ☐ Failed tasks can be rolled back    │ Code Location:                │
│    to pre-execution state             │ src/core/checkpoint.py:89     │
│                                       │                               │
│                                       │ Suggested Fix:                │
│                                       │ Include spec_id in checkpoint │
│                                       │ metadata and restore link     │
│                                       │ on rollback                   │
│ [Update Specification] │ [Apply Fix] │ [Request Clarification]       │
└───────────────────────────────────────┴───────────────────────────────┘
```

**Semantic comparison** reveals intent drift that textual diff would miss.

#### 4.4.3 One-Click Fix Application with Preview

```
┌─ Fix Preview: Add spec_id to checkpoint metadata ───────────────────┐
│ src/core/checkpoint.py                                               │
│ ───────────────────────────────────────────────────────────────────  │
│ class Checkpoint:                                                    │
│     def __init__(self, spec_id: str, ...):      ← Added parameter    │
│         self.spec_id = spec_id                  ← Added assignment   │
│         ...                                                          │
│     def to_dict(self) -> dict:                                       │
│         return {                                                     │
│ +            "spec_id": self.spec_id,         ← Added to serialization│
│              "timestamp": self.timestamp,                            │
│              ...                                                     │
│         }                                                            │
│ [◀ Previous Fix]  [Apply This Fix]  [Next Fix ▶]  [Modify Fix]      │
│                                                                       │
│ ⚠️ This change affects 3 call sites. Verification will re-run after. │
└─────────────────────────────────────────────────────────────────────┘
```

**Preview-before-commit** maintains human oversight of automated corrections.

## 5. Core Implementation: Python Modules

### 5.1 Specification Engine (`core/spec.py`)

#### 5.1.1 `SpecManager` Class: CRUD Operations for Specifications

```python
# core/spec.py - Specification Engine Implementation

from __future__ import annotations

import hashlib
import json
import re
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime
from enum import Enum, auto
from pathlib import Path
from typing import Any, Callable, Iterator, Optional, Protocol, TypeVar

import yaml
from pydantic import BaseModel, Field, validator


class SpecStatus(Enum):
    """Lifecycle states for specification instances."""
    DRAFT = auto()           # Initial creation, incomplete
    PENDING_REVIEW = auto()  # Awaiting human validation
    APPROVED = auto()        # Ready for execution
    IN_PROGRESS = auto()     # Active agent execution
    COMPLETED = auto()       # All tasks finished successfully
    FAILED = auto()          # Execution encountered unrecoverable error
    ARCHIVED = auto()        # Retained for history, no longer active


class TaskStatus(Enum):
    """Execution states for individual tasks."""
    PENDING = auto()         # Waiting for dependencies
    READY = auto()           # Dependencies satisfied, awaiting agent
    ASSIGNED = auto()        # Agent allocated, not yet started
    RUNNING = auto()         # Active agent execution
    COMPLETED = auto()       # Finished successfully
    FAILED = auto()          # Execution failed, may be retryable
    CANCELLED = auto()       # Explicitly aborted


@dataclass(frozen=True)
class SpecVersion:
    """Immutable version identifier with semantic ordering."""
    major: int
    minor: int
    patch: int
    build: Optional[str] = None
    
    def __str__(self) -> str:
        base = f"{self.major}.{self.minor}.{self.patch}"
        return f"{base}+{self.build}" if self.build else base
    
    def __lt__(self, other: SpecVersion) -> bool:
        return (self.major, self.minor, self.patch) < (other.major, other.minor, other.patch)


class AcceptanceCriterion(BaseModel):
    """Verifiable condition for specification satisfaction."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    description: str
    verification_method: str  # "test", "manual", "automated_check"
    automated_test_id: Optional[str] = None
    weight: float = 1.0  # Relative importance for partial satisfaction
    
    class Config:
        frozen = True


class ImplementationNote(BaseModel):
    """Architectural decision or constraint documentation."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    category: str  # "architecture", "performance", "security", "compatibility"
    content: str
    rationale: Optional[str] = None
    alternatives_considered: list[str] = Field(default_factory=list)


class EdgeCase(BaseModel):
    """Identified boundary condition with handling strategy."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    condition: str
    handling_strategy: str
    test_scenario: Optional[str] = None


class Task(BaseModel):
    """Atomic unit of work within specification."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    title: str
    description: str
    status: TaskStatus = TaskStatus.PENDING
    estimated_effort: Optional[str] = None  # "XS", "S", "M", "L", "XL"
    assigned_agent: Optional[str] = None
    dependencies: list[str] = Field(default_factory=list)  # Task IDs
    generated_artifacts: list[str] = Field(default_factory=list)  # File paths
    acceptance_criteria: list[str] = Field(default_factory=list)  # Criterion IDs
    
    # Execution tracking
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    retry_count: int = 0
    max_retries: int = 3


class Specification(BaseModel):
    """Complete specification document with full metadata."""
    # Identity
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    version: SpecVersion = Field(default_factory=lambda: SpecVersion(0, 1, 0))
    parent_id: Optional[str] = None  # For versioning lineage
    
    # Content
    title: str
    description: str
    natural_language_intent: str  # Original user input
    
    # Structure
    acceptance_criteria: list[AcceptanceCriterion] = Field(default_factory=list)
    implementation_notes: list[ImplementationNote] = Field(default_factory=list)
    edge_cases: list[EdgeCase] = Field(default_factory=list)
    tasks: list[Task] = Field(default_factory=list)
    
    # Metadata
    status: SpecStatus = SpecStatus.DRAFT
    tags: list[str] = Field(default_factory=list)
    priority: int = 5  # 1 (highest) to 10 (lowest)
    
    # Audit
    created_by: str = "system"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    modified_at: datetime = Field(default_factory=datetime.utcnow)
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    
    # Execution context
    target_files: list[str] = Field(default_factory=list)
    excluded_files: list[str] = Field(default_factory=list)
    required_agents: list[str] = Field(default_factory=list)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            SpecVersion: lambda v: str(v),
            SpecStatus: lambda v: v.name,
            TaskStatus: lambda v: v.name,
        }


class SpecManager:
    """
    Central coordinator for specification lifecycle operations.
    
    The SpecManager maintains transactional integrity across all
    specification operations, with optimistic concurrency control
    and comprehensive audit logging.
    """
    
    def __init__(
        self,
        storage_path: Path,
        event_callback: Optional[Callable[[str, Any], None]] = None
    ):
        self._storage = storage_path.expanduser().resolve()
        self._storage.mkdir(parents=True, exist_ok=True)
        self._cache: dict[str, Specification] = {}
        self._event_callback = event_callback
        self._lock_file = self._storage / ".lock"
        
    def _emit(self, event_type: str, payload: Any) -> None:
        """Emit event for external observers."""
        if self._event_callback:
            self._event_callback(event_type, payload)
    
    def _spec_path(self, spec_id: str) -> Path:
        """Compute storage path for specification."""
        # Shard by first two characters for directory efficiency
        shard = spec_id[:2]
        return self._storage / shard / f"{spec_id}.yaml"
    
    def _persist(self, spec: Specification) -> None:
        """Atomic write of specification to storage."""
        spec_path = self._spec_path(spec.id)
        spec_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Write to temp file, then atomic rename
        temp_path = spec_path.with_suffix(".tmp")
        with open(temp_path, "w") as f:
            yaml.dump(
                json.loads(spec.json()),  # Pydantic -> dict for yaml
                f,
                default_flow_style=False,
                sort_keys=False,
                allow_unicode=True
            )
        temp_path.replace(spec_path)
        
        # Update cache
        self._cache[spec.id] = spec
        
    def create(
        self,
        title: str,
        description: str,
        natural_language_intent: str,
        **kwargs: Any
    ) -> Specification:
        """
        Create new specification from required fields.
        
        Additional fields (tags, priority, target_files, etc.) may be
        provided as keyword arguments.
        """
        spec = Specification(
            title=title,
            description=description,
            natural_language_intent=natural_language_intent,
            **kwargs
        )
        self._persist(spec)
        self._emit("spec:created", {"id": spec.id, "title": spec.title})
        return spec
    
    def get(self, spec_id: str) -> Optional[Specification]:
        """Retrieve specification by ID, with caching."""
        if spec_id in self._cache:
            return self._cache[spec_id]
        
        spec_path = self._spec_path(spec_id)
        if not spec_path.exists():
            return None
        
        with open(spec_path) as f:
            data = yaml.safe_load(f)
        
        # Reconstruct with proper type conversions
        data["version"] = self._parse_version(data.get("version", "0.1.0"))
        data["status"] = SpecStatus[data.get("status", "DRAFT")]
        for task in data.get("tasks", []):
            task["status"] = TaskStatus[task.get("status", "PENDING")]
        
        spec = Specification.parse_obj(data)
        self._cache[spec_id] = spec
        return spec
    
    def _parse_version(self, v: str) -> SpecVersion:
        """Parse version string to SpecVersion."""
        match = re.match(r"(\d+)\.(\d+)\.(\d+)(?:\+(.+))?", v)
        if not match:
            raise ValueError(f"Invalid version format: {v}")
        return SpecVersion(
            major=int(match.group(1)),
            minor=int(match.group(2)),
            patch=int(match.group(3)),
            build=match.group(4)
        )
    
    def update(self, spec_id: str, **changes: Any) -> Specification:
        """
        Apply updates to existing specification.
        
        Raises ValueError if spec not found, or if changes would
        violate state transition rules.
        """
        spec = self.get(spec_id)
        if spec is None:
            raise ValueError(f"Specification not found: {spec_id}")
        
        # Validate state transitions
        if "status" in changes:
            self._validate_transition(spec.status, changes["status"])
        
        # Apply changes
        current = spec.dict()
        current.update(changes)
        current["modified_at"] = datetime.utcnow()
        
        updated = Specification.parse_obj(current)
        self._persist(updated)
        self._emit("spec:updated", {"id": spec_id, "changes": list(changes.keys())})
        return updated
    
    def _validate_transition(self, from_status: SpecStatus, to_status: Any) -> None:
        """Validate lifecycle state transition."""
        if isinstance(to_status, str):
            to_status = SpecStatus[to_status]
        
        # Define valid transitions
        valid = {
            SpecStatus.DRAFT: {SpecStatus.PENDING_REVIEW, SpecStatus.ARCHIVED},
            SpecStatus.PENDING_REVIEW: {SpecStatus.DRAFT, SpecStatus.APPROVED, SpecStatus.ARCHIVED},
            SpecStatus.APPROVED: {SpecStatus.IN_PROGRESS, SpecStatus.DRAFT, SpecStatus.ARCHIVED},
            SpecStatus.IN_PROGRESS: {SpecStatus.COMPLETED, SpecStatus.FAILED, SpecStatus.ARCHIVED},
            SpecStatus.COMPLETED: {SpecStatus.ARCHIVED},
            SpecStatus.FAILED: {SpecStatus.DRAFT, SpecStatus.IN_PROGRESS, SpecStatus.ARCHIVED},
            SpecStatus.ARCHIVED: set(),  # Terminal state
        }
        
        if to_status not in valid.get(from_status, set()):
            raise ValueError(
                f"Invalid transition: {from_status.name} -> {to_status.name}"
            )
    
    def delete(self, spec_id: str, permanent: bool = False) -> None:
        """
        Remove specification from active set.
        
        By default, archives rather than deletes to preserve history.
        """
        spec = self.get(spec_id)
        if spec is None:
            raise ValueError(f"Specification not found: {spec_id}")
        
        if permanent:
            spec_path = self._spec_path(spec_id)
            spec_path.unlink(missing_ok=True)
            self._cache.pop(spec_id, None)
            self._emit("spec:deleted", {"id": spec_id, "permanent": True})
        else:
            self.update(spec_id, status=SpecStatus.ARCHIVED)
            self._emit("spec:archived", {"id": spec_id})
    
    def list(
        self,
        status: Optional[SpecStatus] = None,
        tag: Optional[str] = None,
        created_after: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0
    ) -> Iterator[Specification]:
        """
        Query specifications with filtering and pagination.
        
        Results are yielded in reverse chronological order by default.
        """
        # Collect all spec IDs from storage
        spec_ids: list[tuple[datetime, str]] = []
        for shard_dir in self._storage.iterdir():
            if not shard_dir.is_dir() or shard_dir.name.startswith("."):
                continue
            for spec_file in shard_dir.glob("*.yaml"):
                spec_id = spec_file.stem
                # Quick metadata check without full parse
                stat = spec_file.stat()
                spec_ids.append((datetime.fromtimestamp(stat.st_mtime), spec_id))
        
        # Sort by modification time, newest first
        spec_ids.sort(reverse=True)
        
        # Apply pagination
        page = spec_ids[offset:offset + limit]
        
        for _, spec_id in page:
            spec = self.get(spec_id)
            if spec is None:
                continue  # Race condition: deleted since listing
            
            # Apply filters
            if status is not None and spec.status != status:
                continue
            if tag is not None and tag not in spec.tags:
                continue
            if created_after is not None and spec.created_at < created_after:
                continue
            
            yield spec
    
    def get_task_graph(self, spec_id: str) -> dict[str, set[str]]:
        """
        Build dependency graph for specification tasks.
        
        Returns adjacency list mapping task IDs to their dependencies.
        """
        spec = self.get(spec_id)
        if spec is None:
            raise ValueError(f"Specification not found: {spec_id}")
        
        return {
            task.id: set(task.dependencies)
            for task in spec.tasks
        }
    
    def get_ready_tasks(self, spec_id: str) -> list[Task]:
        """
        Identify tasks whose dependencies are all completed.
        
        Used by execution scheduler to determine what can run next.
        """
        spec = self.get(spec_id)
        if spec is None:
            raise ValueError(f"Specification not found: {spec_id}")
        
        completed = {
            task.id for task in spec.tasks
            if task.status == TaskStatus.COMPLETED
        }
        
        return [
            task for task in spec.tasks
            if task.status == TaskStatus.PENDING
            and set(task.dependencies).issubset(completed)
        ]
```

#### 5.1.2 Task Dependency Graph Construction

The task dependency graph enables **topological ordering** for execution scheduling and **cycle detection** for validation:

```python
# core/spec.py (continued) - Task Dependency Graph Operations

from collections import deque


class TaskGraphError(Exception):
    """Raised when task graph has invalid structure."""
    pass


def topological_sort(graph: dict[str, set[str]]) -> list[str]:
    """
    Return tasks in dependency-respecting order.
    
    Uses Kahn's algorithm for O(V + E) complexity.
    Raises TaskGraphError if cycle detected.
    """
    # Build reverse graph (dependents -> dependencies)
    in_degree = {node: 0 for node in graph}
    for node, deps in graph.items():
        for dep in deps:
            if dep not in in_degree:
                raise TaskGraphError(f"Unknown dependency: {dep}")
            in_degree[node] += 1
    
    # Start with nodes having no dependencies
    queue = deque([n for n, d in in_degree.items() if d == 0])
    result = []
    
    while queue:
        node = queue.popleft()
        result.append(node)
        
        # Reduce in-degree for all nodes depending on this one
        for other, deps in graph.items():
            if node in deps:
                in_degree[other] -= 1
                if in_degree[other] == 0:
                    queue.append(other)
    
    if len(result) != len(graph):
        # Find cycle for helpful error message
        remaining = set(graph) - set(result)
        raise TaskGraphError(f"Cycle detected involving: {remaining}")
    
    return result


def find_parallel_groups(graph: dict[str, set[str]]) -> list[set[str]]:
    """
    Group tasks that can execute in parallel.
    
    Each group contains tasks with no inter-dependencies,
    all of whose dependencies are in earlier groups.
    """
    sorted_tasks = topological_sort(graph)
    groups = []
    completed = set()
    
    for task in sorted_tasks:
        deps = graph[task]
        # Find which group this task belongs to
        placed = False
        for group in groups:
            # Can join group if all dependencies are in earlier groups
            if deps.issubset(completed):
                group.add(task)
                placed = True
                break
        
        if not placed:
            # Start new group
            groups.append({task})
        
        completed.add(task)
    
    return groups


def get_critical_path(graph: dict[str, set[str]], 
                      durations: dict[str, float]) -> list[str]:
    """
    Identify longest dependency chain determining minimum execution time.
    
    Assumes unlimited parallelism for non-dependent tasks.
    """
    sorted_tasks = topological_sort(graph)
    
    # Forward pass: earliest start times
    earliest_start = {t: 0.0 for t in sorted_tasks}
    for task in sorted_tasks:
        for dep in graph[task]:
            earliest_start[task] = max(
                earliest_start[task],
                earliest_start[dep] + durations.get(dep, 0)
            )
    
    # Backward pass: latest start times
    total_duration = max(
        earliest_start[t] + durations.get(t, 0)
        for t in sorted_tasks
    )
    latest_start = {t: total_duration for t in sorted_tasks}
    for task in reversed(sorted_tasks):
        latest_start[task] = min(
            latest_start[task],
            total_duration - durations.get(task, 0)
        )
        for dep in graph[task]:
            latest_start[dep] = min(
                latest_start[dep],
                latest_start[task] - durations.get(dep, 0)
            )
    
    # Critical path: zero slack tasks
    critical = [
        t for t in sorted_tasks
        if abs(latest_start[t] - earliest_start[t]) < 0.001
    ]
    
    return critical
```

#### 5.1.3 Specification Serialization and Persistence

The persistence layer ensures **atomic writes**, **cache consistency**, and **efficient querying**:

```python
# core/spec.py (continued) - Persistence Implementation Details

import fcntl
import tempfile


class AtomicFileWriter:
    """
    Context manager for atomic file writes using write-then-rename pattern.
    
    Ensures readers never see partially written files.
    """
    
    def __init__(self, path: Path, mode: str = "w"):
        self.final_path = path
        self.mode = mode
        self.temp_file: Optional[tempfile._TemporaryFileWrapper] = None
    
    def __enter__(self):
        # Create temp file in same directory for atomic rename
        self.temp_file = tempfile.NamedTemporaryFile(
            mode=self.mode,
            dir=self.final_path.parent,
            delete=False,
            suffix=".tmp"
        )
        return self.temp_file
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.temp_file is None:
            return
        
        self.temp_file.close()
        
        if exc_type is not None:
            # Exception occurred, clean up temp file
            Path(self.temp_file.name).unlink(missing_ok=True)
            return
        
        # Atomic rename on success
        Path(self.temp_file.name).replace(self.final_path)


class SpecIndex:
    """
    Maintains searchable index of specifications for efficient queries.
    
    Uses SQLite for full-text search and attribute filtering.
    """
    
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._init_db()
    
    def _init_db(self):
        import sqlite3
        
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS specs (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    status TEXT,
                    tags TEXT,  -- JSON array
                    created_at TIMESTAMP,
                    modified_at TIMESTAMP,
                    content_fts  -- For full-text search
                )
            """)
            conn.execute("""
                CREATE VIRTUAL TABLE IF NOT EXISTS specs_fts 
                USING fts5(id, title, description, content=specs)
            """)
            conn.commit()
    
    def index(self, spec: Specification):
        """Add or update specification in index."""
        import sqlite3
        import json
        
        with sqlite3.connect(self.db_path) as conn:
            # Delete existing if present
            conn.execute("DELETE FROM specs WHERE id = ?", (spec.id,))
            
            # Insert new record
            conn.execute("""
                INSERT INTO specs (id, title, description, status, tags,
                                  created_at, modified_at, content_fts)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                spec.id,
                spec.title,
                spec.description,
                spec.status.name,
                json.dumps(spec.tags),
                spec.created_at,
                spec.modified_at,
                f"{spec.title} {spec.description} {spec.natural_language_intent}"
            ))
            conn.commit()
    
    def search(self, query: str, 
               status: Optional[SpecStatus] = None,
               limit: int = 20) -> list[str]:
        """Full-text search returning matching spec IDs."""
        import sqlite3
        
        with sqlite3.connect(self.db_path) as conn:
            if status:
                # Filtered search
                cursor = conn.execute("""
                    SELECT s.id FROM specs s
                    JOIN specs_fts fts ON s.id = fts.id
                    WHERE specs_fts MATCH ? AND s.status = ?
                    ORDER BY rank
                    LIMIT ?
                """, (query, status.name, limit))
            else:
                # Unfiltered search
                cursor = conn.execute("""
                    SELECT s.id FROM specs s
                    JOIN specs_fts fts ON s.id = fts.id
                    WHERE specs_fts MATCH ?
                    ORDER BY rank
                    LIMIT ?
                """, (query, limit))
            
            return [row[0] for row in cursor.fetchall()]
```

### 5.2 AI Agent Abstraction (`core/ai_agent.py`)

#### 5.2.1 Synchronous API Client with Retry Logic

```python
# core/ai_agent.py - AI Agent Abstraction Layer

from __future__ import annotations

import asyncio
import json
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum, auto
from typing import Any, AsyncIterator, Callable, Optional, TypeVar

import httpx
from pydantic import BaseModel, Field


class AgentCapability(Enum):
    """Capabilities that agents may advertise."""
    CHAT_COMPLETION = auto()
    STRUCTURED_OUTPUT = auto()
    FUNCTION_CALLING = auto()
    STREAMING = auto()
    EMBEDDINGS = auto()
    EXTENDED_CONTEXT = auto()  # >100k tokens


@dataclass(frozen=True)
class TokenUsage:
    """Token consumption for a request."""
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    
    @property
    def estimated_cost(self, cost_per_1k: tuple[float, float] = (0.03, 0.06)) -> float:
        """Calculate estimated cost in USD."""
        input_cost = self.prompt_tokens * cost_per_1k[0] / 1000
        output_cost = self.completion_tokens * cost_per_1k[1] / 1000
        return input_cost + output_cost


@dataclass(frozen=True)
class GenerationResult:
    """Complete result from a generation request."""
    text: str
    usage: TokenUsage
    finish_reason: str  # "stop", "length", "content_filter", etc.
    metadata: dict[str, Any] = field(default_factory=dict)


class AgentError(Exception):
    """Base class for agent-related errors."""
    pass


class RateLimitError(AgentError):
    """Raised when rate limit exceeded."""
    pass


class ContextLengthError(AgentError):
    """Raised when prompt exceeds model capacity."""
    pass


class ContentFilterError(AgentError):
    """Raised when content filtered by safety systems."""
    pass


class RetryConfig(BaseModel):
    """Configuration for retry behavior."""
    max_retries: int = 3
    base_delay: float = 1.0  # seconds
    max_delay: float = 60.0  # seconds
    exponential_base: float = 2.0
    retryable_statuses: set[int] = {429, 500, 502, 503, 504}
    
    def compute_delay(self, attempt: int) -> float:
        """Compute delay for retry attempt with jitter."""
        import random
        
        exponential = self.base_delay * (self.exponential_base ** attempt)
        jittered = exponential * (0.5 + random.random())  # ±50% jitter
        return min(jittered, self.max_delay)


class BaseAgent(ABC):
    """
    Abstract base class for AI agent implementations.
    
    Provides common functionality: retry logic, token tracking,
    and unified interface across providers.
    """
    
    def __init__(
        self,
        model: str,
        retry_config: Optional[RetryConfig] = None,
        event_callback: Optional[Callable[[str, Any], None]] = None
    ):
        self.model = model
        self.retry_config = retry_config or RetryConfig()
        self.event_callback = event_callback
        self._usage_stats: list[TokenUsage] = []
    
    def _emit(self, event_type: str, payload: Any) -> None:
        """Emit event for external observers."""
        if self.event_callback:
            self.event_callback(event_type, payload)
    
    @property
    @abstractmethod
    def capabilities(self) -> set[AgentCapability]:
        """Return set of supported capabilities."""
        pass
    
    @abstractmethod
    async def _generate_impl(
        self,
        prompt: str,
        system_message: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs: Any
    ) -> GenerationResult:
        """Provider-specific generation implementation."""
        pass
    
    async def generate(
        self,
        prompt: str,
        system_message: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs: Any
    ) -> GenerationResult:
        """
        Generate completion with retry logic and error handling.
        
        This is the primary public interface for generation.
        """
        last_error: Optional[Exception] = None
        
        for attempt in range(self.retry_config.max_retries + 1):
            try:
                self._emit("agent:generation:start", {
                    "model": self.model,
                    "attempt": attempt,
                    "prompt_length": len(prompt)
                })
                
                start_time = time.monotonic()
                result = await self._generate_impl(
                    prompt=prompt,
                    system_message=system_message,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    **kwargs
                )
                latency = time.monotonic() - start_time
                
                self._usage_stats.append(result.usage)
                self._emit("agent:generation:success", {
                    "model": self.model,
                    "latency": latency,
                    "usage": result.usage.__dict__,
                    "finish_reason": result.finish_reason
                })
                
                return result
                
            except httpx.HTTPStatusError as e:
                last_error = e
                
                if e.response.status_code == 429:
                    last_error = RateLimitError("Rate limit exceeded")
                elif e.response.status_code in self.retry_config.retryable_statuses:
                    pass  # Will retry
                else:
                    raise  # Non-retryable error
                
                if attempt < self.retry_config.max_retries:
                    delay = self.retry_config.compute_delay(attempt)
                    self._emit("agent:generation:retry", {
                        "attempt": attempt,
                        "delay": delay,
                        "error": str(last_error)
                    })
                    await asyncio.sleep(delay)
                else:
                    break
                    
            except ContextLengthError:
                # Don't retry context length errors
                raise
                
            except Exception as e:
                last_error = e
                if attempt < self.retry_config.max_retries:
                    delay = self.retry_config.compute_delay(attempt)
                    await asyncio.sleep(delay)
                else:
                    break
        
        # All retries exhausted
        self._emit("agent:generation:failure", {
            "model": self.model,
            "error": str(last_error),
            "attempts": self.retry_config.max_retries + 1
        })
        raise last_error or AgentError("Generation failed after retries")
    
    async def stream_generate(
        self,
        prompt: str,
        system_message: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs: Any
    ) -> AsyncIterator[str]:
        """
        Stream generation tokens for real-time display.
        
        Base implementation polls non-streaming API.
        Subclasses should override with native streaming.
        """
        # Default: generate full then yield chunks for compatibility
        result = await self.generate(
            prompt=prompt,
            system_message=system_message,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        )
        
        # Simulate streaming by yielding word-by-word
        words = result.text.split()
        for word in words:
            yield word + " "
            await asyncio.sleep(0.01)  # Simulate network delay
    
    def get_usage_summary(self) -> dict[str, Any]:
        """Return aggregated usage statistics."""
        if not self._usage_stats:
            return {"total_requests": 0}
        
        total = TokenUsage(
            prompt_tokens=sum(u.prompt_tokens for u in self._usage_stats),
            completion_tokens=sum(u.completion_tokens for u in self._usage_stats),
            total_tokens=sum(u.total_tokens for u in self._usage_stats)
        )
        
        return {
            "total_requests": len(self._usage_stats),
            "total_tokens": total.__dict__,
            "average_tokens_per_request": total.total_tokens / len(self._usage_stats),
            "estimated_total_cost": total.estimated_cost()
        }


class OpenAIAgent(BaseAgent):
    """OpenAI API implementation with native streaming support."""
    
    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4-turbo-preview",
        base_url: str = "https://api.openai.com/v1",
        **kwargs
    ):
        super().__init__(model=model, **kwargs)
        self.client = httpx.AsyncClient(
            base_url=base_url,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=httpx.Timeout(60.0, connect=10.0)
        )
    
    @property
    def capabilities(self) -> set[AgentCapability]:
        caps = {
            AgentCapability.CHAT_COMPLETION,
            AgentCapability.STRUCTURED_OUTPUT,
            AgentCapability.FUNCTION_CALLING,
            AgentCapability.STREAMING,
            AgentCapability.EMBEDDINGS,
        }
        if "gpt-4" in self.model or "32k" in self.model:
            caps.add(AgentCapability.EXTENDED_CONTEXT)
        return caps
    
    async def _generate_impl(
        self,
        prompt: str,
        system_message: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        response_format: Optional[dict] = None,
        **kwargs: Any
    ) -> GenerationResult:
        messages = []
        if system_message:
            messages.append({"role": "system", "content": system_message})
        messages.append({"role": "user", "content": prompt})
        
        request: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }
        if max_tokens:
            request["max_tokens"] = max_tokens
        if response_format:
            request["response_format"] = response_format
        
        response = await self.client.post(
            "/chat/completions",
            json=request
        )
        response.raise_for_status()
        
        data = response.json()
        choice = data["choices"][0]
        
        return GenerationResult(
            text=choice["message"]["content"],
            usage=TokenUsage(**data["usage"]),
            finish_reason=choice["finish_reason"],
            metadata={"model": data["model"], "id": data["id"]}
        )
    
    async def stream_generate(
        self,
        prompt: str,
        system_message: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs: Any
    ) -> AsyncIterator[str]:
        """Native streaming implementation using SSE."""
        messages = []
        if system_message:
            messages.append({"role": "system", "content": system_message})
        messages.append({"role": "user", "content": prompt})
        
        request = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "stream": True,
        }
        if max_tokens:
            request["max_tokens"] = max_tokens
        
        async with self.client.stream(
            "POST",
            "/chat/completions",
            json=request
        ) as response:
            response.raise_for_status()
            
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:]  # Remove "data: " prefix
                
                if data == "[DONE]":
                    break
                
                try:
                    chunk = json.loads(data)
                    delta = chunk["choices"][0]["delta"]
                    if "content" in delta:
                        yield delta["content"]
                except (json.JSONDecodeError, KeyError):
                    continue


class AnthropicAgent(BaseAgent):
    """Anthropic Claude API implementation."""
    
    def __init__(
        self,
        api_key: str,
        model: str = "claude-3-sonnet-20240229",
        base_url: str = "https://api.anthropic.com/v1",
        **kwargs
    ):
        super().__init__(model=model, **kwargs)
        self.client = httpx.AsyncClient(
            base_url=base_url,
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01"
            },
            timeout=httpx.Timeout(60.0, connect=10.0)
        )
    
    @property
    def capabilities(self) -> set[AgentCapability]:
        # All Claude 3 models have extended context
        return {
            AgentCapability.CHAT_COMPLETION,
            AgentCapability.STRUCTURED_OUTPUT,
            AgentCapability.STREAMING,
            AgentCapability.EXTENDED_CONTEXT,  # 200k tokens
        }
    
    async def _generate_impl(
        self,
        prompt: str,
        system_message: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = 4096,
        **kwargs: Any
    ) -> GenerationResult:
        request: dict[str, Any] = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if system_message:
            request["system"] = system_message
        
        response = await self.client.post("/messages", json=request)
        response.raise_for_status()
        
        data = response.json()
        
        return GenerationResult(
            text=data["content"][0]["text"],
            usage=TokenUsage(
                prompt_tokens=data["usage"]["input_tokens"],
                completion_tokens=data["usage"]["output_tokens"],
                total_tokens=data["usage"]["input_tokens"] + data["usage"]["output_tokens"]
            ),
            finish_reason=data["stop_reason"],
            metadata={"model": data["model"], "id": data["id"]}
        )
```

#### 5.2.2 Prompt Engineering Utilities

```python
# core/ai_agent.py (continued) - Prompt Engineering

import textwrap
from typing import Protocol


class PromptTemplate(Protocol):
    """Protocol for prompt template implementations."""
    
    def render(self, **kwargs: Any) -> str:
        """Render template with given variables."""
        ...


@dataclass
class SpecificationPrompt:
    """
    Structured prompt builder for specification-driven generation.
    
    Ensures consistent prompt structure across different agents
    and generation phases.
    """
    
    system_message: Optional[str] = None
    context_sections: list[tuple[str, str]] = field(default_factory=list)
    instruction: str = ""
    output_format: Optional[str] = None
    examples: list[tuple[str, str]] = field(default_factory=list)
    
    def with_system(self, message: str) -> SpecificationPrompt:
        """Set system message."""
        self.system_message = message
        return self
    
    def with_context(self, name: str, content: str) -> SpecificationPrompt:
        """Add named context section."""
        self.context_sections.append((name, content))
        return self
    
    def with_instruction(self, instruction: str) -> SpecificationPrompt:
        """Set main instruction."""
        self.instruction = instruction
        return self
    
    def with_output_format(self, format_spec: str) -> SpecificationPrompt:
        """Specify expected output format."""
        self.output_format = format_spec
        return self
    
    def with_example(self, input_example: str, output_example: str) -> SpecificationPrompt:
        """Add few-shot example."""
        self.examples.append((input_example, output_example))
        return self
    
    def render(self) -> str:
        """Build complete prompt string."""
        parts = []
        
        # Context sections with clear delimiters
        for name, content in self.context_sections:
            parts.append(f"<{name}>\n{content}\n</{name}>")
        
        # Few-shot examples
        for i, (inp, out) in enumerate(self.examples, 1):
            parts.append(f"<example {i}>\nInput: {inp}\n\nOutput: {out}\n</example {i}>")
        
        # Main instruction
        parts.append(f"<instruction>\n{self.instruction}\n</instruction>")
        
        # Output format specification
        if self.output_format:
            parts.append(f"<output_format>\n{self.output_format}\n</output_format>")
        
        return "\n\n".join(parts)


class CodeGenerationPrompts:
    """
    Curated prompt templates for code generation tasks.
    
    These templates encode best practices for eliciting high-quality
    code generation from language models.
    """
    
    @staticmethod
    def planning_phase(specification: Specification, codebase_context: str) -> SpecificationPrompt:
        """Generate planning prompt from specification."""
        return (
            SpecificationPrompt()
            .with_system(
                "You are an expert software architect. Your task is to decompose "
                "specifications into implementable tasks with clear dependencies."
            )
            .with_context("specification", specification.json(indent=2))
            .with_context("codebase", codebase_context)
            .with_instruction(
                f"Decompose the specification '{specification.title}' into 5-15 "
                "discrete implementation tasks. For each task, provide: "
                "task ID, title, description, estimated effort (XS/S/M/L/XL), "
                "dependencies on other tasks, and acceptance criteria."
            )
            .with_output_format(
                "YAML format with list of tasks. Each task must have: "
                "id, title, description, effort, dependencies (list), "
                "acceptance_criteria (list)."
            )
        )
    
    @staticmethod
    def implementation_phase(
        task: Task,
        specification: Specification,
        relevant_code: str,
        conventions: list[str]
    ) -> SpecificationPrompt:
        """Generate implementation prompt for specific task."""
        return (
            SpecificationPrompt()
            .with_system(
                "You are an expert software engineer implementing features "
                "according to specifications. Write clean, well-tested code "
                "following the project's conventions."
            )
            .with_context("task", task.json())
            .with_context("full_specification", specification.json())
            .with_context("relevant_code", relevant_code)
            .with_context("conventions", "\n".join(f"- {c}" for c in conventions))
            .with_instruction(
                f"Implement the task: {task.title}\n\n{task.description}\n\n"
                "Provide complete, runnable code with appropriate tests. "
                "Follow all specified conventions and match existing code style."
            )
            .with_output_format(
                "For each file created or modified, provide:\n"
                "1. File path\n"
                "2. Complete file content\n"
                "3. Brief explanation of changes\n\n"
                "Use markdown code blocks with language tags."
            )
        )
    
    @staticmethod
    def review_phase(
        implementation: str,
        specification: Specification,
        task: Task
    ) -> SpecificationPrompt:
        """Generate review prompt for verification."""
        return (
            SpecificationPrompt()
            .with_system(
                "You are a senior code reviewer. Verify that implementation "
                "correctly satisfies specification with no regressions."
            )
            .with_context("implementation", implementation)
            .with_context("specification", specification.json())
            .with_context("task", task.json())
            .with_instruction(
                "Review the implementation against the specification. Identify: "
                "1. Correctness issues (does not meet requirements)\n"
                "2. Completeness gaps (partial implementation)\n"
                "3. Quality concerns (style, maintainability, performance)\n"
                "4. Security considerations\n"
                "5. Testing adequacy"
            )
            .with_output_format(
                "Structured review with sections: Summary, Issues (with severity), "
                "Recommendations. Use JSON format for machine parsing."
            )
        )


def truncate_to_tokens(text: str, max_tokens: int, 
                       tokenizer: Optional[Callable[[str], list]] = None) -> str:
    """
    Truncate text to fit within token budget.
    
    Uses approximate tokenization if no tokenizer provided.
    """
    if tokenizer is None:
        # Rough approximation: ~4 characters per token for English
        approx_chars = max_tokens * 4
        if len(text) <= approx_chars:
            return text
        
        # Truncate at word boundary
        truncated = text[:approx_chars]
        last_space = truncated.rfind(' ')
        if last_space > 0:
            truncated = truncated[:last_space]
        return truncated + "\n... [truncated]"
    
    # Precise tokenization
    tokens = tokenizer(text)
    if len(tokens) <= max_tokens:
        return text
    
    # Reconstruct from truncated tokens
    # This requires tokenizer-specific detokenization
    return tokenizer.decode(tokens[:max_tokens]) + "\n... [truncated]"
```

#### 5.2.3 Response Parsing and Structured Output Handling

```python
# core/ai_agent.py (continued) - Response Processing

import re
from typing import TypeVar, Type

T = TypeVar('T', bound=BaseModel)


class StructuredOutputParser:
    """
    Parse and validate structured outputs from language models.
    
    Handles multiple formats: JSON, YAML, XML-tagged, and markdown code blocks.
    """
    
    # Common patterns for extracting structured content
    JSON_BLOCK_PATTERN = re.compile(
        r'```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```',
        re.DOTALL
    )
    YAML_BLOCK_PATTERN = re.compile(
        r'```(?:yaml)?\s*(.*?)\s*```',
        re.DOTALL
    )
    XML_TAG_PATTERN = re.compile(
        r'<(\w+)>(.*?)</\1>',
        re.DOTALL
    )
    
    @classmethod
    def extract_json(cls, text: str) -> Optional[dict]:
        """Extract JSON from various wrapper formats."""
        # Try direct JSON parse first
        text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        
        # Try code block extraction
        for match in cls.JSON_BLOCK_PATTERN.finditer(text):
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                continue
        
        # Try finding JSON-like structure
        # Look for outermost braces/brackets
        start = text.find('{')
        if start == -1:
            start = text.find('[')
        
        if start != -1:
            # Find matching close
            depth = 0
            in_string = False
            escape = False
            
            for i, c in enumerate(text[start:], start):
                if escape:
                    escape = False
                    continue
                if c == '\\':
                    escape = True
                    continue
                if c == '"' and (i == 0 or text[i-1] != '\\'):
                    in_string = not in_string
                    continue
                if in_string:
                    continue
                
                if c in '{[':
                    depth += 1
                elif c in '}]':
                    depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(text[start:i+1])
                        except json.JSONDecodeError:
                            break
        
        return None
    
    @classmethod
    def extract_yaml(cls, text: str) -> Optional[dict]:
        """Extract YAML from various wrapper formats."""
        # Try direct parse
        try:
            return yaml.safe_load(text)
        except yaml.YAMLError:
            pass
        
        # Try code block
        for match in cls.YAML_BLOCK_PATTERN.finditer(text):
            try:
                return yaml.safe_load(match.group(1))
            except yaml.YAMLError:
                continue
        
        return None
    
    @classmethod
    def parse_to_model(cls, text: str, model_class: Type[T]) -> T:
        """
        Parse text to Pydantic model, trying multiple formats.
        
        Raises ValueError if no valid parse possible.
        """
        # Try JSON first (most common)
        data = cls.extract_json(text)
        if data is not None:
            try:
                return model_class.parse_obj(data)
            except Exception as e:
                raise ValueError(f"JSON parsed but invalid for {model_class.__name__}: {e}")
        
        # Try YAML
        data = cls.extract_yaml(text)
        if data is not None:
            try:
                return model_class.parse_obj(data)
            except Exception as e:
                raise ValueError(f"YAML parsed but invalid for {model_class.__name__}: {e}")
        
        # Try XML tag extraction for specific model
        tag_name = model_class.__name__.lower()
        for match in cls.XML_TAG_PATTERN.finditer(text):
            if match.group(1).lower() == tag_name:
                inner = match.group(2)
                # Try JSON/YAML inside tag
                for extractor in [cls.extract_json, cls.extract_yaml]:
                    data = extractor(inner)
                    if data:
                        try:
                            return model_class.parse_obj(data)
                        except:
                            pass
        
        raise ValueError(f"Could not extract valid {model_class.__name__} from text")
    
    @classmethod
    def extract_code_blocks(cls, text: str, 
                           language: Optional[str] = None) -> list[tuple[str, str]]:
        """
        Extract all code blocks with optional language filter.
        
        Returns list of (language, code) tuples.
        """
        pattern = re.compile(
            r'```(\w+)?\s*(.*?)\s*```',
            re.DOTALL
        )
        
        blocks = []
        for match in pattern.finditer(text):
            block_lang = (match.group(1) or "").lower()
            if language is None or block_lang == language.lower():
                blocks.append((block_lang, match.group(2)))
        
        return blocks


class CodeBlockExtractor:
    """
    Specialized extraction for code generation outputs.
    
    Handles common patterns in AI-generated code responses.
    """
    
    FILE_PATH_PATTERN = re.compile(
        r'(?:^|\n)(?:#+|//+|/*)\s*(?:File|Path):\s*(\S+)',
        re.IGNORECASE
    )
    
    @classmethod
    def extract_files(cls, text: str) -> dict[str, str]:
        """
        Extract file path to content mapping from generation output.
        
        Handles multiple common formats:
        - Markdown headers with file paths
        - XML-style <file path="..."> tags
        - Comment-based file markers
        """
        files = {}
        
        # Try explicit file tags first
        file_tag_pattern = re.compile(
            r'<file\s+path=["\']([^"\']+)["\']>(.*?)</file>',
            re.DOTALL
        )
        for match in file_tag_pattern.finditer(text):
            files[match.group(1)] = match.group(2).strip()
        
        if files:
            return files
        
        # Try code blocks with preceding file path
        blocks = StructuredOutputParser.extract_code_blocks(text)
        current_file = None
        
        lines = text.split('\n')
        for i, line in enumerate(lines):
            # Check for file path marker
            path_match = cls.FILE_PATH_PATTERN.search(line)
            if path_match:
                current_file = path_match.group(1)
                continue
            
            # Check for code block start
            if line.strip().startswith('```') and current_file:
                lang = line.strip()[3:].strip()
                # Find matching end
                code_lines = []
                for j in range(i + 1, len(lines)):
                    if lines[j].strip() == '```':
                        files[current_file] = '\n'.join(code_lines)
                        current_file = None
                        break
                    code_lines.append(lines[j])
        
        return files
    
    @classmethod
    def normalize_code(cls, code: str, language: str) -> str:
        """
        Apply language-specific normalization to generated code.
        
        - Ensure trailing newline
        - Normalize indentation (tabs vs spaces)
        - Remove excessive blank lines
        """
        # Ensure trailing newline
        if not code.endswith('\n'):
            code += '\n'
        
        # Detect and normalize indentation
        lines = code.split('\n')
        indent_size = None
        
        for line in lines:
            stripped = line.lstrip()
            if stripped:
                indent = len(line) - len(stripped)
                if indent > 0:
                    if indent_size is None:
                        indent_size = indent
                    else:
                        indent_size = min(indent_size, indent)
        
        if indent_size and indent_size != 4:
            # Normalize to 4 spaces
            normalized = []
            for line in lines:
                stripped = line.lstrip()
                if stripped:
                    indent = len(line) - len(stripped)
                    new_indent = (indent // indent_size) * 4
                    normalized.append(' ' * new_indent + stripped)
                else:
                    normalized.append('')
            code = '\n'.join(normalized)
        
        # Collapse excessive blank lines
        code = re.sub(r'\n{4,}', '\n\n\n', code)
        
        return code
```

### 5.3 Code Generation Pipeline (`core/code_generator.py`)

#### 5.3.1 Multi-Stage Generation: Plan → Skeleton → Implementation

```python
# core/code_generator.py - Code Generation Pipeline

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from enum import Enum, auto
from pathlib import Path
from typing import Any, Callable, Optional

from core.ai_agent import AgentCapability, BaseAgent, GenerationResult, SpecificationPrompt
from core.spec import Specification, Task, TaskStatus


class GenerationStage(Enum):
    """Stages in the multi-phase generation pipeline."""
    PLANNING = auto()      # Architectural decisions, file structure
    SKELETON = auto()      # Interface definitions, type stubs
    IMPLEMENTATION = auto()  # Full working code
    VERIFICATION = auto()  # Self-check and test generation


@dataclass
class GenerationContext:
    """Accumulated context through generation stages."""
    specification: Specification
    current_task: Task
    codebase_root: Path
    
    # Accumulated artifacts
    plan: Optional[dict] = None
    skeleton: Optional[dict[str, str]] = None
    implementation: Optional[dict[str, str]] = None
    tests: Optional[dict[str, str]] = None
    
    # Metadata
    files_created: list[Path] = field(default_factory=list)
    files_modified: list[Path] = field(default_factory=list)
    tokens_consumed: int = 0
    
    def record_file(self, path: Path, created: bool = True):
        """Track file operation."""
        if created:
            self.files_created.append(path)
        else:
            self.files_modified.append(path)


class CodeGenerator:
    """
    Orchestrates multi-stage code generation with checkpointing.
    
    Each stage builds on previous stages, enabling progressive
    refinement and early error detection.
    """
    
    def __init__(
        self,
        agent: BaseAgent,
        codebase_context: Callable[[], str],
        event_callback: Optional[Callable[[str, Any], None]] = None
    ):
        self.agent = agent
        self.codebase_context = codebase_context
        self.event_callback = event_callback
        
        # Stage-specific prompts
        self.prompts = {
            GenerationStage.PLANNING: self._planning_prompt,
            GenerationStage.SKELETON: self._skeleton_prompt,
            GenerationStage.IMPLEMENTATION: self._implementation_prompt,
            GenerationStage.VERIFICATION: self._verification_prompt,
        }
    
    def _emit(self, event_type: str, payload: Any) -> None:
        """Emit progress event."""
        if self.event_callback:
            self.event_callback(event_type, payload)
    
    async def generate(
        self,
        ctx: GenerationContext,
        stages: Optional[list[GenerationStage]] = None
    ) -> GenerationContext:
        """
        Execute full generation pipeline for a task.
        
        Runs specified stages in order, accumulating results in context.
        """
        stages = stages or list(GenerationStage)
        
        for stage in stages:
            self._emit("generation:stage:start", {
                "stage": stage.name,
                "task": ctx.current_task.id
            })
            
            try:
                ctx = await self._run_stage(ctx, stage)
                self._emit("generation:stage:complete", {
                    "stage": stage.name,
                    "tokens": ctx.tokens_consumed
                })
            except Exception as e:
                self._emit("generation:stage:error", {
                    "stage": stage.name,
                    "error": str(e)
                })
                raise
        
        return ctx
    
    async def _run_stage(
        self,
        ctx: GenerationContext,
        stage: GenerationStage
    ) -> GenerationContext:
        """Execute single generation stage."""
        prompt_builder = self.prompts[stage]
        prompt = prompt_builder(ctx)
        
        # Check if agent supports structured output
        if AgentCapability.STRUCTURED_OUTPUT in self.agent.capabilities:
            result = await self.agent.generate(
                prompt=prompt.render(),
                system_message=prompt.system_message,
                response_format={"type": "json_object"}
            )
        else:
            result = await self.agent.generate(
                prompt=prompt.render(),
                system_message=prompt.system_message
            )
        
        ctx.tokens_consumed += result.usage.total_tokens
        
        # Parse and store stage output
        parser = self._get_parser(stage)
        parsed = parser(result.text, ctx)
        
        # Update context based on stage
        if stage == GenerationStage.PLANNING:
            ctx.plan = parsed
        elif stage == GenerationStage.SKELETON:
            ctx.skeleton = parsed
        elif stage == GenerationStage.IMPLEMENTATION:
            ctx.implementation = parsed
        elif stage == GenerationStage.VERIFICATION:
            ctx.tests = parsed.get("tests", {})
        
        return ctx
    
    def _planning_prompt(self, ctx: GenerationContext) -> SpecificationPrompt:
        """Build planning stage prompt."""
        return SpecificationPrompt()\
            .with_system(
                "You are an expert software architect. Create a detailed "
                "implementation plan including file structure, key interfaces, "
                "and design decisions."
            )\
            .with_context("specification", ctx.specification.json())\
            .with_context("task", ctx.current_task.json())\
            .with_context("codebase", self.codebase_context())\
            .with_instruction(
                "Create an implementation plan for this task. Include:\n"
                "1. Files to create or modify\n"
                "2. Key functions/classes and their signatures\n"
                "3. Dependencies and integration points\n"
                "4. Error handling strategy\n"
                "5. Testing approach"
            )\
            .with_output_format(
                "JSON with fields: files (list), interfaces (object), "
                "dependencies (list), error_handling (string), testing (string)"
            )
    
    def _skeleton_prompt(self, ctx: GenerationContext) -> SpecificationPrompt:
        """Build skeleton generation prompt."""
        return SpecificationPrompt()\
            .with_system(
                "You are defining interfaces and type signatures. "
                "Focus on clear contracts, not implementation details."
            )\
            .with_context("specification", ctx.specification.json())\
            .with_context("task", ctx.current_task.json())\
            .with_context("plan", json.dumps(ctx.plan))\
            .with_instruction(
                "Generate skeleton code with:\n"
                "1. Complete type annotations\n"
                "2. Function/class signatures with docstrings\n"
                "3. Abstract methods where appropriate\n"
                "4. TODO comments for implementation\n"
                "No actual implementation logic yet."
            )\
            .with_output_format(
                "For each file, provide complete content with type stubs. "
                "Use markdown code blocks with file paths."
            )
    
    def _implementation_prompt(self, ctx: GenerationContext) -> SpecificationPrompt:
        """Build full implementation prompt."""
        return SpecificationPrompt()\
            .with_system(
                "You are implementing working, production-ready code. "
                "Follow best practices, handle edge cases, include error handling."
            )\
            .with_context("specification", ctx.specification.json())\
            .with_context("task", ctx.current_task.json())\
            .with_context("skeleton", json.dumps(ctx.skeleton))\
            .with_instruction(
                "Implement complete, working code based on the skeleton. "
                "Requirements:\n"
                "1. All functions fully implemented\n"
                "2. Comprehensive error handling\n"
                "3. Input validation\n"
                "4. Logging where appropriate\n"
                "5. Follow existing code style"
            )\
            .with_output_format(
                "Complete file contents. Use markdown code blocks. "
                "Include brief explanation of non-obvious implementation choices."
            )
    
    def _verification_prompt(self, ctx: GenerationContext) -> SpecificationPrompt:
        """Build self-verification and test generation prompt."""
        return SpecificationPrompt()\
            .with_system(
                "You are creating tests and verifying implementation correctness. "
                "Be thorough but practical."
            )\
            .with_context("specification", ctx.specification.json())\
            .with_context("task", ctx.current_task.json())\
            .with_context("implementation", json.dumps(ctx.implementation))\
            .with_instruction(
                "Generate comprehensive tests and verify implementation:\n"
                "1. Unit tests for all public functions\n"
                "2. Edge case coverage\n"
                "3. Integration tests if appropriate\n"
                "4. Identify any issues or gaps"
            )\
            .with_output_format(
                "JSON with: tests (object: filename -> content), "
                "issues (list), confidence_score (0-1)"
            )
    
    def _get_parser(
        self,
        stage: GenerationStage
    ) -> Callable[[str, GenerationContext], Any]:
        """Get appropriate parser for stage output."""
        from core.ai_agent import StructuredOutputParser
        
        parsers = {
            GenerationStage.PLANNING: lambda t, c: StructuredOutputParser.extract_json(t),
            GenerationStage.SKELETON: lambda t, c: StructuredOutputParser.extract_code_blocks(t),
            GenerationStage.IMPLEMENTATION: lambda t, c: CodeBlockExtractor.extract_files(t),
            GenerationStage.VERIFICATION: lambda t, c: StructuredOutputParser.extract_json(t),
        }
        return parsers[stage]
```

#### 5.3.2 Language-Specific Template Engines

```python
# core/code_generator.py (continued) - Template Engines

import re
from string import Template


class LanguageTemplateEngine:
    """
    Base class for language-specific code templates.
    
    Provides common functionality with language-specific overrides.
    """
    
    LANGUAGE: str = ""
    FILE_EXTENSION: str = ""
    INDENT: str = "    "  # 4 spaces default
    
    def __init__(self, conventions: dict[str, Any]):
        self.conventions = conventions
    
    def render_class(
        self,
        name: str,
        bases: Optional[list[str]] = None,
        methods: Optional[list[dict]] = None,
        docstring: Optional[str] = None
    ) -> str:
        """Render class definition."""
        raise NotImplementedError
    
    def render_function(
        self,
        name: str,
        params: list[tuple[str, str, Optional[str]]],  # (name, type, default)
        return_type: Optional[str] = None,
        body: Optional[str] = None,
        docstring: Optional[str] = None,
        async_: bool = False
    ) -> str:
        """Render function/method definition."""
        raise NotImplementedError
    
    def render_import(
        self,
        module: str,
        names: Optional[list[str]] = None,
        is_from: bool = True
    ) -> str:
        """Render import statement."""
        raise NotImplementedError


class PythonTemplateEngine(LanguageTemplateEngine):
    """Python-specific template engine."""
    
    LANGUAGE = "python"
    FILE_EXTENSION = ".py"
    
    TYPE_MAP = {
        "string": "str",
        "integer": "int",
        "number": "float",
        "boolean": "bool",
        "array": "list",
        "object": "dict",
        "any": "Any",
    }
    
    def render_class(
        self,
        name: str,
        bases: Optional[list[str]] = None,
        methods: Optional[list[dict]] = None,
        docstring: Optional[str] = None,
        dataclass: bool = False
    ) -> str:
        """Render Python class with optional dataclass decorator."""
        lines = []
        
        if dataclass:
            lines.append("from dataclasses import dataclass")
            lines.append("")
            lines.append("@dataclass")
        
        base_str = f"({', '.join(bases)})" if bases else ""
        lines.append(f"class {name}{base_str}:")
        
        if docstring:
            lines.append(f'{self.INDENT}"""{docstring}"""')
        
        if methods:
            for method in methods:
                lines.append("")
                lines.append(self._render_method(method, is_dataclass=dataclass))
        else:
            lines.append(f"{self.INDENT}pass")
        
        return "\n".join(lines)
    
    def _render_method(self, method: dict, is_dataclass: bool = False) -> str:
        """Render method with proper self/cls handling."""
        name = method["name"]
        params = method.get("params", [])
        return_type = method.get("return_type")
        body = method.get("body", "pass")
        docstring = method.get("docstring")
        is_static = method.get("static", False)
        is_classmethod = method.get("classmethod", False)
        
        lines = []
        
        # Decorators
        if is_static:
            lines.append(f"{self.INDENT}@staticmethod")
        elif is_classmethod:
            lines.append(f"{self.INDENT}@classmethod")
        
        # Method signature
        if is_static:
            param_str = ", ".join(self._format_param(p) for p in params)
        elif is_classmethod:
            param_str = "cls" + (", " if params else "")
            param_str += ", ".join(self._format_param(p) for p in params)
        else:
            param_str = "self" + (", " if params else "")
            param_str += ", ".join(self._format_param(p) for p in params)
        
        return_ann = f" -> {self._map_type(return_type)}" if return_type else ""
        lines.append(f"{self.INDENT}def {name}({param_str}){return_ann}:")
        
        # Docstring
        if docstring:
            lines.append(f'{self.INDENT}{self.INDENT}"""{docstring}"""')
        
        # Body
        for line in body.split("\n"):
            lines.append(f"{self.INDENT}{self.INDENT}{line}")
        
        return "\n".join(lines)
    
    def _format_param(self, param: tuple) -> str:
        """Format parameter with type and default."""
        name, type_, default = param
        type_str = f": {self._map_type(type_)}" if type_ else ""
        default_str = f" = {default!r}" if default is not None else ""
        return f"{name}{type_str}{default_str}"
    
    def _map_type(self, type_str: Optional[str]) -> str:
        """Map generic types to Python types."""
        if not type_str:
            return "Any"
        return self.TYPE_MAP.get(type_str.lower(), type_str)
    
    def render_function(
        self,
        name: str,
        params: list[tuple[str, str, Optional[str]]],
        return_type: Optional[str] = None,
        body: Optional[str] = None,
        docstring: Optional[str] = None,
        async_: bool = False
    ) -> str:
        """Render standalone function."""
        lines = []
        
        async_str = "async " if async_ else ""
        param_str = ", ".join(self._format_param(p) for p in params)
        return_ann = f" -> {self._map_type(return_type)}" if return_type else ""
        
        lines.append(f"{async_str}def {name}({param_str}){return_ann}:")
        
        if docstring:
            lines.append(f'{self.INDENT}"""{docstring}"""')
        
        if body:
            for line in body.split("\n"):
                lines.append(f"{self.INDENT}{line}")
        else:
            lines.append(f"{self.INDENT}...")
        
        return "\n".join(lines)
    
    def render_import(
        self,
        module: str,
        names: Optional[list[str]] = None,
        is_from: bool = True
    ) -> str:
        """Render Python import."""
        if is_from and names:
            return f"from {module} import {', '.join(names)}"
        return f"import {module}"


class TypeScriptTemplateEngine(LanguageTemplateEngine):
    """TypeScript/JavaScript template engine."""
    
    LANGUAGE = "typescript"
    FILE_EXTENSION = ".ts"
    
    def render_class(
        self,
        name: str,
        bases: Optional[list[str]] = None,
        methods: Optional[list[dict]] = None,
        docstring: Optional[str] = None,
        interfaces: Optional[list[str]] = None
    ) -> str:
        """Render TypeScript class with interfaces."""
        lines = []
        
        # JSDoc for docstring
        if docstring:
            lines.append("/**")
            for line in docstring.split("\n"):
                lines.append(f" * {line}")
            lines.append(" */")
        
        # Interface implementations
        impl_str = ""
        if interfaces:
            impl_str = f" implements {', '.join(interfaces)}"
        
        base_str = ""
        if bases:
            base_str = f" extends {bases[0]}"  # TS single inheritance
        
        lines.append(f"export class {name}{base_str}{impl_str} {{")
        
        if methods:
            for method in methods:
                lines.append("")
                lines.append(self._render_method(method))
        
        lines.append("}")
        
        return "\n".join(lines)
    
    def _render_method(self, method: dict) -> str:
        """Render TypeScript method."""
        name = method["name"]
        params = method.get("params", [])
        return_type = method.get("return_type", "void")
        body = method.get("body", "// TODO: implement")
        access = method.get("access", "public")
        is_async = method.get("async", False)
        
        lines = []
        
        param_str = ", ".join(
            f"{p[0]}: {p[1]}" + (f" = {p[2]!r}" if p[2] else "")
            for p in params
        )
        
        async_str = "async " if is_async else ""
        return_str = f": {return_type}" if return_type else ""
        
        lines.append(f"{self.INDENT}{access} {async_str}{name}({param_str}){return_str} {{")
        
        for line in body.split("\n"):
            lines.append(f"{self.INDENT}{self.INDENT}{line}")
        
        lines.append(f"{self.INDENT}}}")
        
        return "\n".join(lines)
    
    def render_function(
        self,
        name: str,
        params: list[tuple[str, str, Optional[str]]],
        return_type: Optional[str] = None,
        body: Optional[str] = None,
        docstring: Optional[str] = None,
        async_: bool = False
    ) -> str:
        """Render TypeScript function."""
        lines = []
        
        if docstring:
            lines.append("/**")
            for line in docstring.split("\n"):
                lines.append(f" * {line}")
            lines.append(" */")
        
        param_str = ", ".join(
            f"{p[0]}: {p[1]}" + (f" = {p[2]!r}" if p[2] else "")
            for p in params
        )
        
        async_str = "async " if async_ else ""
        return_str = f": {return_type or 'void'}"
        
        lines.append(f"export {async_str}function {name}({param_str}){return_str} {{")
        
        if body:
            for line in body.split("\n"):
                lines.append(f"{self.INDENT}{line}")
        else:
            lines.append(f"{self.INDENT}throw new Error('Not implemented');")
        
        lines.append("}")
        
        return "\n".join(lines)
    
    def render_import(
        self,
        module: str,
        names: Optional[list[str]] = None,
        is_from: bool = True
    ) -> str:
        """Render TypeScript import."""
        if is_from and names:
            return f"import {{ {', '.join(names)} }} from '{module}';"
        return f"import * as {module.split('/')[-1]} from '{module}';"


class TemplateRegistry:
    """Registry of language-specific template engines."""
    
    _engines: dict[str, type[LanguageTemplateEngine]] = {
        "python": PythonTemplateEngine,
        "typescript": TypeScriptTemplateEngine,
        "javascript": TypeScriptTemplateEngine,  # Similar enough
    }
    
    @classmethod
    def get_engine(cls, language: str, conventions: dict[str, Any]) -> LanguageTemplateEngine:
        """Get appropriate template engine for language."""
        engine_class = cls._engines.get(language.lower())
        if not engine_class:
            raise ValueError(f"No template engine for language: {language}")
        return engine_class(conventions)
    
    @classmethod
    def register(cls, language: str, engine: type[LanguageTemplateEngine]) -> None:
        """Register custom template engine."""
        cls._engines[language.lower()] = engine
```

#### 5.3.3 Post-Processing: Formatting, Linting, Import Resolution

```python
# core/code_generator.py (continued) - Post-Processing

import subprocess
from pathlib import Path


class CodePostProcessor:
    """
    Applies language-specific formatting and validation to generated code.
    
    Ensures generated code meets project standards before presentation.
    """
    
    def __init__(self, project_root: Path):
        self.project_root = project_root
    
    async def process(self, files: dict[str, str], language: str) -> dict[str, str]:
        """
        Apply full post-processing pipeline to generated files.
        
        Returns processed files with any fixes applied.
        """
        processed = {}
        
        for path_str, content in files.items():
            path = self.project_root / path_str
            
            # Write to temporary location for tool processing
            temp_path = self._write_temp(path, content)
            
            try:
                # Apply formatters
                formatted = await self._format(temp_path, language)
                
                # Fix imports
                with_imports = await self._fix_imports(formatted, path, language)
                
                # Validate syntax
                validated = await self._validate_syntax(with_imports, language)
                
                processed[path_str] = validated
                
            finally:
                # Cleanup
                temp_path.unlink(missing_ok=True)
        
        return processed
    
    def _write_temp(self, original_path: Path, content: str) -> Path:
        """Write content to temporary file with correct extension."""
        import tempfile
        
        suffix = original_path.suffix
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=suffix,
            delete=False
        ) as f:
            f.write(content)
            return Path(f.name)
    
    async def _format(self, path: Path, language: str) -> str:
        """Apply language-specific formatter."""
        formatters = {
            "python": self._format_python,
            "typescript": self._format_typescript,
            "javascript": self._format_typescript,
        }
        
        formatter = formatters.get(language)
        if not formatter:
            return path.read_text()
        
        return await formatter(path)
    
    async def _format_python(self, path: Path) -> str:
        """Apply black and isort formatting."""
        # Try black first
        try:
            result = await asyncio.create_subprocess_exec(
                "black", "--quiet", "--fast", str(path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await result.communicate()
        except FileNotFoundError:
            pass  # black not installed
        
        # Then isort
        try:
            result = await asyncio.create_subprocess_exec(
                "isort", "--quiet", str(path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await result.communicate()
        except FileNotFoundError:
            pass
        
        return path.read_text()
    
    async def _format_typescript(self, path: Path) -> str:
        """Apply prettier formatting."""
        try:
            result = await asyncio.create_subprocess_exec(
                "prettier", "--write", "--parser", "typescript", str(path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await result.communicate()
        except FileNotFoundError:
            pass
        
        return path.read_text()
    
    async def _fix_imports(self, content: str, original_path: Path, language: str) -> str:
        """Resolve and organize imports."""
        if language == "python":
            return await self._fix_python_imports(content, original_path)
        elif language in ("typescript", "javascript"):
            return await self._fix_ts_imports(content, original_path)
        return content
    
    async def _fix_python_imports(self, content: str, original_path: Path) -> str:
        """Add missing imports and organize."""
        # Simple heuristic: check for common patterns
        imports_to_add = []
        
        if "datetime" in content and "from datetime" not in content:
            if "datetime.datetime" in content or "datetime." in content:
                imports_to_add.append("from datetime import datetime")
            else:
                imports_to_add.append("import datetime")
        
        if "Path" in content and "from pathlib" not in content:
            imports_to_add.append("from pathlib import Path")
        
        if "Optional" in content and "from typing" not in content:
            imports_to_add.append("from typing import Optional")
        
        # Add imports at top if any found
        if imports_to_add:
            lines = content.split("\n")
            # Find insertion point (after existing imports, before code)
            insert_idx = 0
            for i, line in enumerate(lines):
                if line.startswith(("import ", "from ")):
                    insert_idx = i + 1
            
            new_lines = lines[:insert_idx]
            new_lines.extend(imports_to_add)
            new_lines.extend(lines[insert_idx:])
            content = "\n".join(new_lines)
        
        return content
    
    async def _fix_ts_imports(self, content: str, original_path: Path) -> str:
        """Resolve TypeScript module imports."""
        # Placeholder: would use tsc or language server
        return content
    
    async def _validate_syntax(self, content: str, language: str) -> str:
        """Validate and report syntax errors."""
        validators = {
            "python": self._validate_python,
            "typescript": self._validate_typescript,
        }
        
        validator = validators.get(language)
        if validator:
            await validator(content)
        
        return content
    
    async def _validate_python(self, content: str) -> None:
        """Validate Python syntax without execution."""
        import ast
        
        try:
            ast.parse(content)
        except SyntaxError as e:
            # Add helpful comment at error location
            lines = content.split("\n")
            if e.lineno and 1 <= e.lineno <= len(lines):
                lines[e.lineno - 1] += f"  # SYNTAX ERROR: {e.msg}"
            raise SyntaxError(f"Generated code has syntax error: {e}") from e
    
    async def _validate_typescript(self, content: str) -> None:
        """Validate TypeScript without full compilation."""
        # Would use tsc --noEmit or similar
        pass
```

### 5.4 Verification Framework (`core/code_verifier.py`)

#### 5.4.1 Pluggable Verifier Interface

```python
# core/code_verifier.py - Verification Framework

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Optional

from pydantic import BaseModel


class Severity(Enum):
    """Issue severity levels."""
    CRITICAL = "critical"  # Must fix, blocks acceptance
    ERROR = "error"        # Should fix, strongly recommended
    WARNING = "warning"    # Consider fixing, style/quality
    INFO = "info"          # Informational, no action required


class IssueLocation(BaseModel):
    """Location of a verification issue."""
    file: Optional[str] = None
    line: Optional[int] = None
    column: Optional[int] = None
    end_line: Optional[int] = None
    end_column: Optional[int] = None


class VerificationIssue(BaseModel):
    """Single issue found by verification."""
    id: str
    severity: Severity
    category: str  # "syntax", "style", "security", "performance", etc.
    message: str
    location: IssueLocation
    suggestion: Optional[str] = None
    auto_fixable: bool = False
    fix_code: Optional[str] = None  # Suggested fix if auto_fixable


class VerificationResult(BaseModel):
    """Complete result from a verifier."""
    verifier_name: str
    passed: bool
    issues: list[VerificationIssue] = []
    metrics: dict[str, Any] = {}  # Coverage, complexity, etc.
    duration_ms: float = 0.0


class BaseVerifier(ABC):
    """
    Abstract base for all verification implementations.
    
    Verifiers check generated code against quality criteria
    and report issues with appropriate severity.
    """
    
    def __init__(
        self,
        config: Optional[dict[str, Any]] = None,
        event_callback: Optional[Callable[[str, Any], None]] = None
    ):
        self.config = config or {}
        self.event_callback = event_callback
        self.name = self.__class__.__name__
    
    def _emit(self, event_type: str, payload: Any) -> None:
        """Emit progress event."""
        if self.event_callback:
            self.event_callback(event_type, payload)
    
    @property
    @abstractmethod
    def supported_languages(self) -> set[str]:
        """Languages this verifier can process."""
        pass
    
    @abstractmethod
    async def verify(
        self,
        files: dict[str, str],  # path -> content
        context: dict[str, Any]  # specification, task, etc.
    ) -> VerificationResult:
        """Execute verification and return results."""
        pass
    
    def can_verify(self, language: str) -> bool:
        """Check if verifier supports given language."""
        return language.lower() in {l.lower() for l in self.supported_languages}


class VerifierRegistry:
    """Registry and orchestration for multiple verifiers."""
    
    def __init__(self):
        self._verifiers: list[BaseVerifier] = []
        self._by_category: dict[str, list[BaseVerifier]] = {}
    
    def register(self, verifier: BaseVerifier, categories: Optional[list[str]] = None) -> None:
        """Register a verifier for use."""
        self._verifiers.append(verifier)
        
        for cat in categories or ["general"]:
            self._by_category.setdefault(cat, []).append(verifier)
    
    async def verify_all(
        self,
        files: dict[str, str],
        context: dict[str, Any],
        categories: Optional[list[str]] = None,
        languages: Optional[list[str]] = None
    ) -> list[VerificationResult]:
        """Run all applicable verifiers and aggregate results."""
        # Determine which verifiers to run
        to_run = []
        for verifier in self._verifiers:
            # Check category filter
            if categories:
                verifier_cats = set()
                for cat, verifiers in self._by_category.items():
                    if verifier in verifiers:
                        verifier_cats.add(cat)
                if not verifier_cats.intersection(categories):
                    continue
            
            # Check language support
            if languages:
                if not any(verifier.can_verify(l) for l in languages):
                    continue
            
            to_run.append(verifier)
        
        # Execute in parallel
        tasks = [v.verify(files, context) for v in to_run]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Handle exceptions
        processed = []
        for verifier, result in zip(to_run, results):
            if isinstance(result, Exception):
                processed.append(VerificationResult(
                    verifier_name=verifier.name,
                    passed=False,
                    issues=[VerificationIssue(
                        id=f"{verifier.name}_error",
                        severity=Severity.ERROR,
                        category="verification",
                        message=f"Verifier failed: {result}",
                        location=IssueLocation()
                    )]
                ))
            else:
                processed.append(result)
        
        return processed
    
    def get_issue_summary(self, results: list[VerificationResult]) -> dict[Severity, int]:
        """Aggregate issue counts by severity."""
        summary = {s: 0 for s in Severity}
        for result in results:
            for issue in result.issues:
                summary[issue.severity] += 1
        return summary
```

#### 5.4.2 Built-in Verifiers: Syntax, Style, Security, Performance

```python
# core/code_verifier.py (continued) - Built-in Verifiers

import ast
import re
import subprocess
import tempfile


class PythonSyntaxVerifier(BaseVerifier):
    """Verify Python code syntax and basic correctness."""
    
    @property
    def supported_languages(self) -> set[str]:
        return {"python"}
    
    async def verify(
        self,
        files: dict[str, str],
        context: dict[str, Any]
    ) -> VerificationResult:
        import time
        
        start = time.monotonic()
        issues = []
        
        for path, content in files.items():
            if not path.endswith(".py"):
                continue
            
            # Parse AST
            try:
                tree = ast.parse(content)
            except SyntaxError as e:
                issues.append(VerificationIssue(
                    id="syntax_error",
                    severity=Severity.CRITICAL,
                    category="syntax",
                    message=f"Syntax error: {e.msg}",
                    location=IssueLocation(
                        file=path,
                        line=e.lineno,
                        column=e.offset
                    ),
                    auto_fixable=False
                ))
                continue
            
            # Check for undefined names (basic)
            undefined = self._find_undefined_names(tree, content)
            for name, line, col in undefined:
                issues.append(VerificationIssue(
                    id=f"undefined_name_{name}",
                    severity=Severity.ERROR,
                    category="correctness",
                    message=f"Potentially undefined name: {name}",
                    location=IssueLocation(file=path, line=line, column=col),
                    auto_fixable=False
                ))
            
            # Check for bare except
            for node in ast.walk(tree):
                if isinstance(node, ast.ExceptHandler) and node.type is None:
                    issues.append(VerificationIssue(
                        id="bare_except",
                        severity=Severity.WARNING,
                        category="style",
                        message="Bare 'except:' clause catches SystemExit and KeyboardInterrupt",
                        location=IssueLocation(
                            file=path,
                            line=getattr(node, 'lineno', 0)
                        ),
                        suggestion="Use 'except Exception:' instead",
                        auto_fixable=True,
                        fix_code="except Exception:"
                    ))
        
        duration = (time.monotonic() - start) * 1000
        
        return VerificationResult(
            verifier_name=self.name,
            passed=len([i for i in issues if i.severity in (Severity.CRITICAL, Severity.ERROR)]) == 0,
            issues=issues,
            duration_ms=duration
        )
    
    def _find_undefined_names(
        self,
        tree: ast.AST,
        source: str
    ) -> list[tuple[str, int, int]]:
        """Find names that might be undefined."""
        # Simple analysis: collect assigned names, check uses
        # Full analysis would need scope tracking
        assigned = set()
        undefined = []
        
        for node in ast.walk(tree):
            if isinstance(node, ast.Name):
                if isinstance(node.ctx, ast.Store):
                    assigned.add(node.id)
                elif isinstance(node.ctx, ast.Load) and node.id not in assigned:
                    # Check if builtin or import
                    if not (node.id in dir(__builtins__) or 
                            self._is_imported(node.id, tree)):
                        undefined.append((node.id, node.lineno, node.col_offset))
        
        return undefined
    
    def _is_imported(self, name: str, tree: ast.AST) -> bool:
        """Check if name comes from import."""
        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                for alias in node.names:
                    if alias.asname == name or alias.name == name:
                        return True
                    if alias.name.startswith(f"{name}."):
                        return True
        return False


class RuffStyleVerifier(BaseVerifier):
    """Python style verification using ruff."""
    
    @property
    def supported_languages(self) -> set[str]:
        return {"python"}
    
    async def verify(
        self,
        files: dict[str, str],
        context: dict[str, Any]
    ) -> VerificationResult:
        import json
        import time
        
        start = time.monotonic()
        
        # Write files to temp directory
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            for path, content in files.items():
                full_path = tmp_path / path
                full_path.parent.mkdir(parents=True, exist_ok=True)
                full_path.write_text(content)
            
            # Run ruff
            try:
                proc = await asyncio.create_subprocess_exec(
                    "ruff", "check", "--output-format", "json",
                    str(tmp_path),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                stdout, stderr = await proc.communicate()
                
                if proc.returncode not in (0, 1):  # 0 = clean, 1 = issues found
                    # Ruff error
                    return VerificationResult(
                        verifier_name=self.name,
                        passed=False,
                        issues=[VerificationIssue(
                            id="ruff_error",
                            severity=Severity.ERROR,
                            category="verification",
                            message=f"Ruff failed: {stderr.decode()}",
                            location=IssueLocation()
                        )],
                        duration_ms=(time.monotonic() - start) * 1000
                    )
                
                # Parse ruff output
                ruff_issues = json.loads(stdout.decode() or "[]")
                
            except FileNotFoundError:
                return VerificationResult(
                    verifier_name=self.name,
                    passed=True,  # Can't verify, assume OK
                    issues=[VerificationIssue(
                        id="ruff_not_found",
                        severity=Severity.INFO,
                        category="verification",
                        message="Ruff not installed, skipping style checks",
                        location=IssueLocation()
                    )],
                    duration_ms=(time.monotonic() - start) * 1000
                )
        
        # Convert ruff issues to our format
        severity_map = {
            "E": Severity.ERROR,      # Error
            "F": Severity.CRITICAL,   # Pyflakes (often correctness)
            "I": Severity.WARNING,    # isort
            "N": Severity.WARNING,    # pep8-naming
            "W": Severity.WARNING,    # Warning
            "UP": Severity.INFO,      # pyupgrade
            "B": Severity.ERROR,      # flake8-bugbear
            "C4": Severity.INFO,      # comprehensions
            "SIM": Severity.INFO,     # simplify
        }
        
        issues = []
        for ri in ruff_issues:
            code = ri.get("code", "UNKNOWN")
            prefix = code.split("0")[0] if code[0].isalpha() else code[0]
            
            issues.append(VerificationIssue(
                id=f"ruff_{code}",
                severity=severity_map.get(prefix, Severity.WARNING),
                category="style",
                message=ri.get("message", ""),
                location=IssueLocation(
                    file=ri.get("filename", ""),
                    line=ri.get("location", {}).get("row"),
                    column=ri.get("location", {}).get("column")
                ),
                auto_fixable=code in self._get_fixable_codes(),
                fix_code=ri.get("fix", {}).get("content") if ri.get("fix") else None
            ))
        
        duration = (time.monotonic() - start) * 1000
        
        return VerificationResult(
            verifier_name=self.name,
            passed=len([i for i in issues if i.severity in (Severity.CRITICAL, Severity.ERROR)]) == 0,
            issues=issues,
            duration_ms=duration
        )
    
    def _get_fixable_codes(self) -> set[str]:
        """Ruff codes that support auto-fix."""
        # Common fixable codes
        return {
            "I001",  # unsorted-imports
            "F401",  # unused-import
            "F841",  # unused-variable
            "E501",  # line-too-long (sometimes)
            "W291",  # trailing-whitespace
            "W292",  # missing-newline-at-end-of-file
        }


class BanditSecurityVerifier(BaseVerifier):
    """Security-focused verification using bandit."""
    
    @property
    def supported_languages(self) -> set[str]:
        return {"python"}
    
    async def verify(
        self,
        files: dict[str, str],
        context: dict[str, Any]
    ) -> VerificationResult:
        import json
        import time
        
        start = time.monotonic()
        
        # Write files to temp directory
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            for path, content in files.items():
                full_path = tmp_path / path
                full_path.parent.mkdir(parents=True, exist_ok=True)
                full_path.write_text(content)
            
            # Run bandit
            try:
                proc = await asyncio.create_subprocess_exec(
                    "bandit", "-f", "json", "-r",
                    str(tmp_path),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                stdout, stderr = await proc.communicate()
                
                # Bandit returns 0 even with issues, parse output
                bandit_output = json.loads(stdout.decode() or "{}")
                
            except FileNotFoundError:
                return VerificationResult(
                    verifier_name=self.name,
                    passed=True,
                    issues=[VerificationIssue(
                        id="bandit_not_found",
                        severity=Severity.INFO,
                        category="verification",
                        message="Bandit not installed, skipping security checks",
                        location=IssueLocation()
                    )],
                    duration_ms=(time.monotonic() - start) * 1000
                )
            except json.JSONDecodeError:
                return VerificationResult(
                    verifier_name=self.name,
                    passed=False,
                    issues=[VerificationIssue(
                        id="bandit_parse_error",
                        severity=Severity.ERROR,
                        category="verification",
                        message=f"Failed to parse bandit output: {stdout.decode()[:200]}",
                        location=IssueLocation()
                    )],
                    duration_ms=(time.monotonic() - start) * 1000
                )
        
        # Convert bandit issues
        severity_map = {
            "LOW": Severity.WARNING,
            "MEDIUM": Severity.ERROR,
            "HIGH": Severity.CRITICAL,
        }
        
        issues = []
        for result in bandit_output.get("results", []):
            issues.append(VerificationIssue(
                id=f"bandit_{result.get('test_id', 'UNKNOWN')}",
                severity=severity_map.get(result.get("issue_severity"), Severity.WARNING),
                category="security",
                message=f"{result.get('issue_text', '')} [{result.get('test_name', '')}]",
                location=IssueLocation(
                    file=result.get("filename", ""),
                    line=result.get("line_number"),
                ),
                suggestion=result.get("more_info", ""),
                auto_fixable=False  # Security issues need human review
            ))
        
        duration = (time.monotonic() - start) * 1000
        
        return VerificationResult(
            verifier_name=self.name,
            passed=len([i for i in issues if i.severity == Severity.CRITICAL]) == 0,
            issues=issues,
            metrics={"confidence_score": bandit_output.get("metrics", {}).get("_totals", {}).get("confidence_score", 0)},
            duration_ms=duration
        )


class ComplexityVerifier(BaseVerifier):
    """Check code complexity metrics."""
    
    @property
    def supported_languages(self) -> set[str]:
        return {"python", "typescript", "javascript"}
    
    async def verify(
        self,
        files: dict[str, str],
        context: dict[str, Any]
    ) -> VerificationResult:
        import time
        
        start = time.monotonic()
        issues = []
        
        max_complexity = self.config.get("max_cyclomatic_complexity", 10)
        max_lines = self.config.get("max_function_lines", 50)
        
        for path, content in files.items():
            if not path.endswith((".py", ".ts", ".js")):
                continue
            
            # Simple line-based analysis
            # Full implementation would use AST for accurate complexity
            lines = content.split("\n")
            
            in_function = False
            function_start = 0
            function_indent = 0
            function_lines = 0
            function_branches = 0
            
            for i, line in enumerate(lines):
                stripped = line.lstrip()
                indent = len(line) - len(stripped)
                
                # Detect function start (simplified)
                if stripped.startswith(("def ", "function ", "async def ")):
                    in_function = True
                    function_start = i
                    function_indent = indent
                    function_lines = 0
                    function_branches = 1  # Base path
                
                if in_function:
                    function_lines += 1
                    
                    # Count branches (simplified)
                    if any(stripped.startswith(kw) for kw in 
                           ["if ", "elif ", "else:", "for ", "while ", 
                            "except", "with ", "and ", "or "]):
                        function_branches += 1
                    
                    # Detect function end (next same-level or lower indent)
                    if stripped and indent <= function_indent and i > function_start:
                        # Check complexity
                        if function_branches > max_complexity:
                            issues.append(VerificationIssue(
                                id="high_complexity",
                                severity=Severity.WARNING,
                                category="maintainability",
                                message=f"Function has cyclomatic complexity ~{function_branches} (max {max_complexity})",
                                location=IssueLocation(file=path, line=function_start + 1),
                                suggestion="Consider refactoring into smaller functions",
                                auto_fixable=False
                            ))
                        
                        if function_lines > max_lines:
                            issues.append(VerificationIssue(
                                id="long_function",
                                severity=Severity.WARNING,
                                category="maintainability",
                                message=f"Function is {function_lines} lines (max {max_lines})",
                                location=IssueLocation(file=path, line=function_start + 1),
                                suggestion="Extract helper functions",
                                auto_fixable=False
                            ))
                        
                        in_function = False
        
        duration = (time.monotonic() - start) * 1000
        
        return VerificationResult(
            verifier_name=self.name,
            passed=True,  # Warnings don't fail
            issues=issues,
            duration_ms=duration
        )
```

#### 5.4.3 Custom Verifier Registration

```python
# core/code_verifier.py (continued) - Custom Verifier Support

import importlib.util


class CustomVerifierLoader:
    """
    Load and register custom verifiers from project or user directories.
    
    Enables teams to add domain-specific verification without modifying core.
    """
    
    SEARCH_PATHS = [
        Path(".openkode/verifiers"),  # Project-local
        Path.home() / ".config" / "openkode" / "verifiers",  # User-global
    ]
    
    @classmethod
    def load_all(cls, registry: VerifierRegistry) -> list[str]:
        """Discover and load all custom verifiers."""
        loaded = []
        
        for search_path in cls.SEARCH_PATHS:
            if not search_path.exists():
                continue
            
            for verifier_file in search_path.glob("*_verifier.py"):
                try:
                    verifier_class = cls._load_verifier(verifier_file)
                    instance = verifier_class()
                    registry.register(instance, categories=["custom"])
                    loaded.append(verifier_class.__name__)
                except Exception as e:
                    # Log but don't fail
                    print(f"Failed to load custom verifier {verifier_file}: {e}")
        
        return loaded
    
    @classmethod
    def _load_verifier(cls, path: Path) -> type[BaseVerifier]:
        """Load verifier class from Python file."""
        spec = importlib.util.spec_from_file_location(
            f"custom_verifier_{path.stem}",
            path
        )
        if spec is None or spec.loader is None:
            raise ImportError(f"Cannot load spec from {path}")
        
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        
        # Find verifier class
        for name, obj in module.__dict__.items():
            if (isinstance(obj, type) and 
                issubclass(obj, BaseVerifier) and 
                obj is not BaseVerifier):
                return obj
        
        raise ValueError(f"No BaseVerifier subclass found in {path}")


# Example custom verifier template
"""
# my_custom_verifier.py - Example custom verifier

from core.code_verifier import BaseVerifier, VerificationResult, VerificationIssue
from core.code_verifier import Severity, IssueLocation


class DjangoNPlusOneVerifier(BaseVerifier):
    # Custom verifier for Django N+1 query detection
    
    @property
    def supported_languages(self):
        return {"python"}
    
    async def verify(self, files, context):
        issues = []
        
        for path, content in files.items():
            # Look for patterns that suggest N+1 queries
            # e.g., loops with database access inside
            
            if "for " in content and (".filter(" in content or ".all()" in content):
                # Simplified detection - real implementation would use AST
                lines = content.split("\n")
                for i, line in enumerate(lines):
                    if "for " in line and i < len(lines) - 1:
                        next_lines = "\n".join(lines[i:i+5])
                        if ".filter(" in next_lines or ".all()" in next_lines:
                            issues.append(VerificationIssue(
                                id="potential_nplusone",
                                severity=Severity.WARNING,
                                category="performance",
                                message="Potential N+1 query pattern detected",
                                location=IssueLocation(file=path, line=i+1),
                                suggestion="Consider using select_related() or prefetch_related()",
                                auto_fixable=False
                            ))
        
        return VerificationResult(
            verifier_name=self.name,
            passed=len([i for i in issues if i.severity == Severity.CRITICAL]) == 0,
            issues=issues
        )
"""
```

### 5.5 Command-Line Interface (`ui/cli.py`)

#### 5.5.1 Interactive REPL with Command History

```python
# ui/cli.py - Command-Line Interface

from __future__ import annotations

import asyncio
import shlex
import sys
from pathlib import Path
from typing import Any, Optional

from prompt_toolkit import PromptSession
from prompt_toolkit.auto_suggest import AutoSuggestFromHistory
from prompt_toolkit.completion import Completer, Completion, WordCompleter
from prompt_toolkit.history import FileHistory
from prompt_toolkit.key_binding import KeyBindings
from prompt_toolkit.styles import Style


class OpenKodeREPL:
    """
    Interactive REPL for OpenKode with rich command completion and history.
    """
    
    COMMANDS = {
        "spec": "Specification management",
        "agent": "Agent control and configuration",
        "generate": "Trigger code generation",
        "verify": "Run verification on code",
        "status": "Show current system status",
        "config": "View and modify configuration",
        "help": "Show help for commands",
        "exit": "Exit OpenKode",
        "quit": "Exit OpenKode",
    }
    
    def __init__(
        self,
        spec_manager: Any,  # SpecManager
        agent_pool: Any,    # AgentPool
        config: dict[str, Any]
    ):
        self.spec_manager = spec_manager
        self.agent_pool = agent_pool
        self.config = config
        
        # Setup prompt toolkit session
        history_path = Path.home() / ".openkode_history"
        self.session = PromptSession(
            history=FileHistory(str(history_path)),
            auto_suggest=AutoSuggestFromHistory(),
            completer=self._build_completer(),
            style=self._build_style(),
            key_bindings=self._build_key_bindings()
        )
        
        self.running = False
        self.last_result: Optional[Any] = None
    
    def _build_completer(self) -> Completer:
        """Build command completer with context-aware suggestions."""
        # Base command completer
        command_completer = WordCompleter(
            list(self.COMMANDS.keys()),
            meta_dict=self.COMMANDS,
            ignore_case=True
        )
        
        # Dynamic completer that changes based on context
        class DynamicCompleter(Completer):
            def __init__(self, repl: OpenKodeREPL):
                self.repl = repl
            
            def get_completions(self, document, complete_event):
                text = document.text_before_cursor
                
                # First word: command completion
                if " " not in text:
                    for completion in command_completer.get_completions(document, complete_event):
                        yield completion
                    return
                
                # After command: context-specific completion
                command = text.split()[0]
                remainder = text[len(command):].lstrip()
                
                if command == "spec":
                    yield from self._spec_completions(remainder)
                elif command == "agent":
                    yield from self._agent_completions(remainder)
                # ... etc
        
        return DynamicCompleter(self)
    
    def _spec_completions(self, text: str):
        """Generate completions for spec command."""
        subcommands = ["list", "create", "show", "edit", "delete", "execute"]
        for sc in subcommands:
            if sc.startswith(text):
                yield Completion(sc, start_position=-len(text))
        
        # If we have "spec show " or similar, complete with spec IDs
        if any(text.startswith(sc + " ") for sc in ["show", "edit", "execute", "delete"]):
            # Would query spec_manager for IDs
            pass
    
    def _build_style(self) -> Style:
        """Build color style for prompt."""
        return Style.from_dict({
            "prompt": "#00aa00 bold",      # Green prompt
            "command": "#0088ff",           # Blue commands
            "arg": "#ff8800",               # Orange arguments
            "error": "#ff0000",             # Red errors
            "success": "#00ff00",           # Green success
        })
    
    def _build_key_bindings(self) -> KeyBindings:
        """Custom key bindings for REPL."""
        kb = KeyBindings()
        
        @kb.add("c-x")  # Ctrl+X
        def _(event):
            """Quick exit."""
            event.app.exit(exception=EOFError)
        
        @kb.add("c-r")  # Ctrl+R
        def _(event):
            """Refresh/reload."""
            # Would trigger context refresh
            pass
        
        return kb
    
    async def run(self) -> None:
        """Main REPL loop."""
        self.running = True
        
        self._print_banner()
        
        while self.running:
            try:
                # Build dynamic prompt
                prompt_text = self._build_prompt()
                
                # Get input
                user_input = await self.session.prompt_async(prompt_text)
                user_input = user_input.strip()
                
                if not user_input:
                    continue
                
                # Parse and execute
                await self._execute(user_input)
                
            except (EOFError, KeyboardInterrupt):
                self.running = False
                print("\nGoodbye!")
            except Exception as e:
                print(f"Error: {e}", file=sys.stderr)
    
    def _build_prompt(self) -> list[tuple[str, str]]:
        """Build styled prompt showing current context."""
        # Would include: current spec, agent status, etc.
        return [
            ("class:prompt", "openkode"),
            ("", " "),
            ("class:arg", "❯ "),
        ]
    
    def _print_banner(self) -> None:
        """Print welcome banner."""
        print("""
    ╔═══════════════════════════════════════════════════════════════╗
    ║                                                               ║
    ║   ██████  ██████  ███████ ███    ██ ██   ██ ██████   ██████   ║
    ║  ██    ██ ██   ██ ██      ████   ██ ██  ██  ██   ██ ██        ║
    ║  ██    ██ ██████  █████   ██ ██  ██ █████   ██   ██ ██   ███  ║
    ║  ██    ██ ██   ██ ██      ██  ██ ██ ██  ██  ██   ██ ██    ██  ║
    ║   ██████  ██   ██ ███████ ██   ████ ██   ██ ██████   ██████   ║
    ║                                                               ║
    ║              Specification-Driven Development                 ║
    ║                                                               ║
    ╚═══════════════════════════════════════════════════════════════╝
    
    Type 'help' for available commands, 'exit' to quit.
    """)
    
    async def _execute(self, command_line: str) -> None:
        """Parse and execute command."""
        parts = shlex.split(command_line)
        if not parts:
            return
        
        command = parts[0].lower()
        args = parts[1:]
        
        handler = getattr(self, f"_cmd_{command}", None)
        if handler:
            try:
                await handler(args)
            except Exception as e:
                print(f"Command failed: {e}")
        else:
            print(f"Unknown command: {command}")
            print(f"Type 'help' for available commands")
    
    async def _cmd_help(self, args: list[str]) -> None:
        """Show help information."""
        if args:
            # Specific command help
            topic = args[0]
            print(f"Help for '{topic}':")
            # Would show detailed help
        else:
            # General help
            print("Available commands:")
            for cmd, desc in sorted(self.COMMANDS.items()):
                print(f"  {cmd:12} - {desc}")
    
    async def _cmd_spec(self, args: list[str]) -> None:
        """Specification management commands."""
        if not args:
            print("Usage: spec <subcommand> [options]")
            print("Subcommands: list, create, show, edit, delete, execute")
            return
        
        subcommand = args[0]
        
        if subcommand == "list":
            specs = list(self.spec_manager.list(limit=20))
            print(f"{'ID':<10} {'Status':<12} {'Title'}")
            print("-" * 60)
            for spec in specs:
                status = spec.status.name[:10]
                title = spec.title[:40]
                print(f"{spec.id[:8]:<10} {status:<12} {title}")
        
        elif subcommand == "create":
            # Interactive creation
            title = input("Title: ")
            description = input("Description: ")
            intent = input("Intent (or press Enter to use description): ") or description
            
            spec = self.spec_manager.create(
                title=title,
                description=description,
                natural_language_intent=intent
            )
            print(f"Created specification: {spec.id}")
        
        elif subcommand == "show":
            if len(args) < 2:
                print("Usage: spec show <spec-id>")
                return
            
            spec = self.spec_manager.get(args[1])
            if spec:
                print(f"Specification: {spec.title}")
                print(f"Status: {spec.status.name}")
                print(f"Tasks: {len(spec.tasks)}")
                for task in spec.tasks:
                    print(f"  - {task.id}: {task.title} [{task.status.name}]")
            else:
                print(f"Specification not found: {args[1]}")
        
        # ... other subcommands
    
    async def _cmd_agent(self, args: list[str]) -> None:
        """Agent control commands."""
        if not args:
            # Show status
            status = self.agent_pool.get_status()
            print(f"Active agents: {status['active']}")
            print(f"Queued tasks: {status['queued']}")
            for agent in status['agents']:
                print(f"  - {agent['name']}: {agent['status']}")
            return
        
        subcommand = args[0]
        # ... implement start, stop, config subcommands
    
    async def _cmd_generate(self, args: list[str]) -> None:
        """Trigger code generation for a specification."""
        if not args:
            print("Usage: generate <spec-id> [task-id]")
            return
        
        spec_id = args[0]
        task_id = args[1] if len(args) > 1 else None
        
        # Would trigger generation pipeline
        print(f"Starting generation for {spec_id}...")
        # Async generation with progress updates
    
    async def _cmd_verify(self, args: list[str]) -> None:
        """Run verification on generated code."""
        # Implementation...
        pass
    
    async def _cmd_status(self, args: list[str]) -> None:
        """Show system status."""
        print("OpenKode Status")
        print("=" * 40)
        print(f"Version: 0.1.0")
        print(f"Config: {self.config.get('config_path', 'default')}")
        print(f"Specs directory: {self.spec_manager._storage}")
        # ... more status
    
    async def _cmd_config(self, args: list[str]) -> None:
        """View and modify configuration."""
        # Implementation...
        pass
    
    async def _cmd_exit(self, args: list[str]) -> None:
        """Exit REPL."""
        self.running = False
        print("Shutting down...")
    
    _cmd_quit = _cmd_exit  # Alias
```

#### 5.5.2 Structured Output Modes (JSON, TTY, Silent)

```python
# ui/cli.py (continued) - Output Formatting

import json
from enum import Enum, auto


class OutputMode(Enum):
    """Output formatting modes for CLI."""
    TTY = auto()      # Rich terminal output with colors
    JSON = auto()     # Machine-readable JSON
    SILENT = auto()   # Errors only
    PLAIN = auto()    # Text without formatting


class OutputFormatter:
    """
    Format command output according to selected mode.
    
    Enables scripting integration and human readability.
    """
    
    def __init__(self, mode: OutputMode = OutputMode.TTY):
        self.mode = mode
        self._is_tty = sys.stdout.isatty()
        
        # Auto-detect if not explicitly set
        if mode == OutputMode.TTY and not self._is_tty:
            self.mode = OutputMode.PLAIN
    
    def print(self, data: Any, **kwargs: Any) -> None:
        """Print data in appropriate format."""
        if self.mode == OutputMode.SILENT:
            return
        
        if self.mode == OutputMode.JSON:
            print(json.dumps(self._to_json_serializable(data), indent=2))
            return
        
        if self.mode == OutputMode.PLAIN:
            print(self._to_plain_text(data))
            return
        
        # TTY mode with rich formatting
        print(self._to_rich_text(data, **kwargs))
    
    def error(self, message: str) -> None:
        """Print error message (always shown)."""
        if self.mode == OutputMode.JSON:
            print(json.dumps({"error": message}))
        elif self.mode in (OutputMode.TTY, OutputMode.PLAIN):
            print(f"Error: {message}", file=sys.stderr)
        # SILENT still shows critical errors
    
    def _to_json_serializable(self, data: Any) -> Any:
        """Convert data to JSON-serializable format."""
        if isinstance(data, BaseModel):
            return data.dict()
        if isinstance(data, (list, tuple)):
            return [self._to_json_serializable(item) for item in data]
        if isinstance(data, dict):
            return {k: self._to_json_serializable(v) for k, v in data.items()}
        if isinstance(data, Enum):
            return data.name
        return data
    
    def _to_plain_text(self, data: Any) -> str:
        """Convert to plain text representation."""
        if isinstance(data, str):
            return data
        
        if isinstance(data, BaseModel):
            lines = []
            for key, value in data.dict().items():
                lines.append(f"{key}: {value}")
            return "\n".join(lines)
        
        if isinstance(data, list):
            return "\n".join(self._to_plain_text(item) for item in data)
        
        return str(data)
    
    def _to_rich_text(self, data: Any, **kwargs: Any) -> str:
        """Convert to rich terminal output with colors/formatting."""
        from rich.console import Console
        from rich.table import Table
        from rich.tree import Tree
        
        # Use rich for sophisticated formatting
        console = Console(file=sys.stdout, force_terminal=True)
        
        # Would implement rich-specific formatting
        # This is a simplified version
        return self._to_plain_text(data)  # Fallback


def parse_output_mode(arg: Optional[str]) -> OutputMode:
    """Parse output mode from command line argument."""
    if not arg:
        return OutputMode.TTY
    
    mapping = {
        "tty": OutputMode.TTY,
        "json": OutputMode.JSON,
        "silent": OutputMode.SILENT,
        "plain": OutputMode.PLAIN,
    }
    
    return mapping.get(arg.lower(), OutputMode.TTY)
```

#### 5.5.3 Progress Indicators and Spinner States

```python
# ui/cli.py (continued) - Progress Indication

from contextlib import asynccontextmanager
from typing import AsyncIterator


class ProgressIndicator:
    """
    Visual progress indication for long-running operations.
    
    Supports multiple styles: spinner, progress bar, and streaming output.
    """
    
    SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
    
    def __init__(self, formatter: OutputFormatter):
        self.formatter = formatter
        self._active = False
        self._frame_index = 0
        self._task: Optional[asyncio.Task] = None
    
    async def _spin(self, message: str) -> None:
        """Spinner animation loop."""
        import sys
        import time
        
        while self._active:
            frame = self.SPINNER_FRAMES[self._frame_index % len(self.SPINNER_FRAMES)]
            self._frame_index += 1
            
            # Clear line and print spinner
            sys.stdout.write(f"\r{frame} {message}")
            sys.stdout.flush()
            
            await asyncio.sleep(0.1)
        
        # Clear line
        sys.stdout.write("\r" + " " * (len(message) + 2) + "\r")
        sys.stdout.flush()
    
    @asynccontextmanager
    async def spin(self, message: str) -> AsyncIterator[None]:
        """Context manager for spinner during operation."""
        if self.formatter.mode != OutputMode.TTY:
            # No spinner in non-TTY modes
            yield
            return
        
        self._active = True
        self._task = asyncio.create_task(self._spin(message))
        
        try:
            yield
        finally:
            self._active = False
            if self._task:
                self._task.cancel()
                try:
                    await self._task
                except asyncio.CancelledError:
                    pass
    
    def progress_bar(
        self,
        current: int,
        total: int,
        width: int = 40,
        prefix: str = "",
        suffix: str = ""
    ) -> str:
        """Generate progress bar string."""
        if total == 0:
            filled = 0
        else:
            filled = int(width * current / total)
        
        bar = "█" * filled + "░" * (width - filled)
        percent = 100 * current // total if total > 0 else 0
        
        return f"{prefix} |{bar}| {percent}% {suffix}"


class StreamingOutputHandler:
    """
    Handle streaming output from AI agents with real-time display.
    
    Buffers and formats streaming tokens for terminal display.
    """
    
    def __init__(self, formatter: OutputFormatter):
        self.formatter = formatter
        self._buffer: list[str] = []
        self._in_code_block = False
        self._code_language = ""
    
    async def handle_stream(
        self,
        stream: AsyncIterator[str],
        show_thinking: bool = False
    ) -> str:
        """
        Process streaming tokens and display appropriately.
        
        Returns complete accumulated text.
        """
        import sys
        
        complete = []
        
        async for token in stream:
            complete.append(token)
            
            if self.formatter.mode != OutputMode.TTY:
                continue  # Don't display in non-TTY
            
            # Detect code block start/end for syntax highlighting
            if "```" in token:
                # Toggle code block state
                pass  # Would implement proper detection
            
            # Write token with appropriate formatting
            sys.stdout.write(token)
            sys.stdout.flush()
        
        # Final newline
        if self.formatter.mode == OutputMode.TTY:
            sys.stdout.write("\n")
            sys.stdout.flush()
        
        return "".join(complete)
```

## 6. Process Optimization Implementation

### 6.1 Asynchronous and Parallel Execution

#### 6.1.1 `asyncio`-Based Agent Pool (`ai_agent_parallel.py`)

```python
# core/ai_agent_parallel.py - Parallel Agent Execution

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, AsyncIterator, Callable, Optional

import structlog

logger = structlog.get_logger()


class TaskPriority(Enum):
    """Priority levels for agent task scheduling."""
    CRITICAL = 0   # Blocking user interaction
    HIGH = 1       # User-initiated, time-sensitive
    NORMAL = 2     # Standard background work
    LOW = 3        # Batch processing, can defer
    BACKGROUND = 4 # Maintenance, analytics


@dataclass
class QueuedTask:
    """Task waiting for agent allocation."""
    id: str
    coro: Callable[[], asyncio.Future]
    priority: TaskPriority
    estimated_tokens: int
    agent_preferences: list[str] = field(default_factory=list)
    created_at: float = field(default_factory=asyncio.get_event_loop().time)
    
    def __lt__(self, other: QueuedTask) -> bool:
        # Higher priority (lower number) comes first
        # Then earlier creation time
        if self.priority.value != other.priority.value:
            return self.priority.value < other.priority.value
        return self.created_at < other.created_at


class AgentPool:
    """
    Managed pool of AI agent connections with intelligent scheduling.
    
    Handles concurrent requests, rate limiting, and optimal resource use.
    """
    
    def __init__(
        self,
        agents: dict[str, BaseAgent],
        max_concurrent: int = 5,
        token_budget_per_minute: int = 100000,
        event_callback: Optional[Callable[[str, Any], None]] = None
    ):
        self.agents = agents
        self.max_concurrent = max_concurrent
        self.token_budget = token_budget_per_minute
        self.event_callback = event_callback
        
        # Concurrency control
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._token_bucket = TokenBucket(rate=token_budget_per_minute / 60.0, capacity=token_budget)
        
        # Task queue
        self._queue: asyncio.PriorityQueue[tuple[int, QueuedTask]] = asyncio.PriorityQueue()
        self._in_flight: dict[str, asyncio.Task] = {}
        self._results: dict[str, Any] = {}
        
        # Metrics
        self._total_requests = 0
        self._total_tokens = 0
        self._start_time = asyncio.get_event_loop().time()
    
    def _emit(self, event_type: str, payload: Any) -> None:
        """Emit event for monitoring."""
        if self.event_callback:
            self.event_callback(event_type, payload)
        logger.info(event_type, **payload)
    
    async def submit(
        self,
        task_id: str,
        coro: Callable[[], asyncio.Future],
        priority: TaskPriority = TaskPriority.NORMAL,
        estimated_tokens: int = 1000,
        agent_preferences: Optional[list[str]] = None
    ) -> asyncio.Future:
        """
        Submit task for execution, returning Future for result.
        
        Task is queued and executed when agent capacity available.
        """
        task = QueuedTask(
            id=task_id,
            coro=coro,
            priority=priority,
            estimated_tokens=estimated_tokens,
            agent_preferences=agent_preferences or []
        )
        
        # Create future for result
        loop = asyncio.get_event_loop()
        future = loop.create_future()
        
        # Store association
        self._results[task_id] = future
        
        # Add to queue (priority queue uses tuple: (priority_value, task))
        await self._queue.put((priority.value, task))
        
        self._emit("pool:task:queued", {
            "task_id": task_id,
            "priority": priority.name,
            "queue_depth": self._queue.qsize()
        })
        
        # Ensure worker is running
        self._ensure_worker()
        
        return future
    
    def _ensure_worker(self) -> None:
        """Start task processor if not running."""
        # Implementation would manage worker task lifecycle
        pass
    
    async def _process_queue(self) -> None:
        """Main worker loop processing queued tasks."""
        while True:
            # Wait for token budget
            priority, task = await self._queue.get()
            
            # Check token availability
            if not await self._token_bucket.consume(task.estimated_tokens):
                # Re-queue with slight delay if budget exhausted
                await asyncio.sleep(1)
                await self._queue.put((priority, task))
                continue
            
            # Acquire concurrency slot
            async with self._semaphore:
                self._emit("pool:task:start", {
                    "task_id": task.id,
                    "wait_time": asyncio.get_event_loop().time() - task.created_at
                })
                
                # Select optimal agent
                agent = self._select_agent(task.agent_preferences)
                
                # Execute with monitoring
                start = asyncio.get_event_loop().time()
                try:
                    result = await task.coro()
                    latency = asyncio.get_event_loop().time() - start
                    
                    # Update metrics
                    self._total_requests += 1
                    if hasattr(result, 'usage'):
                        self._total_tokens += result.usage.total_tokens
                        await self._token_bucket.consume(result.usage.total_tokens - task.estimated_tokens)
                    
                    # Complete future
                    future = self._results.pop(task.id, None)
                    if future and not future.done():
                        future.set_result(result)
                    
                    self._emit("pool:task:success", {
                        "task_id": task.id,
                        "latency": latency,
                        "agent": agent.model if agent else "unknown"
                    })
                    
                except Exception as e:
                    latency = asyncio.get_event_loop().time() - start
                    
                    future = self._results.pop(task.id, None)
                    if future and not future.done():
                        future.set_exception(e)
                    
                    self._emit("pool:task:error", {
                        "task_id": task.id,
                        "latency": latency,
                        "error": str(e)
                    })
    
    def _select_agent(self, preferences: list[str]) -> Optional[BaseAgent]:
        """Select best available agent based on preferences and load."""
        # Simple implementation: first available from preferences
        for pref in preferences:
            if pref in self.agents:
                return self.agents[pref]
        
        # Fallback: least recently used
        # Would track usage and select optimally
        return next(iter(self.agents.values())) if self.agents else None
    
    def get_status(self) -> dict[str, Any]:
        """Return current pool status."""
        return {
            "agents": len(self.agents),
            "max_concurrent": self.max_concurrent,
            "queue_depth": self._queue.qsize(),
            "in_flight": len(self._in_flight),
            "total_requests": self._total_requests,
            "total_tokens": self._total_tokens,
            "uptime": asyncio.get_event_loop().time() - self._start_time,
            "token_budget_remaining": self._token_bucket.tokens if hasattr(self, '_token_bucket') else 0,
        }


class TokenBucket:
    """
    Rate limiter using token bucket algorithm.
    
    Allows burst consumption up to capacity, then throttles to rate.
    """
    
    def __init__(self, rate: float, capacity: float):
        self.rate = rate  # tokens per second
        self.capacity = capacity
        self.tokens = capacity
        self.last_update = asyncio.get_event_loop().time()
        self._lock = asyncio.Lock()
    
    async def consume(self, amount: float, timeout: Optional[float] = None) -> bool:
        """
        Attempt to consume tokens, waiting if necessary.
        
        Returns True if consumed, False if timeout or impossible.
        """
        async with self._lock:
            # Update tokens based on elapsed time
            now = asyncio.get_event_loop().time()
            elapsed = now - self.last_update
            self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
            self.last_update = now
            
            if self.tokens >= amount:
                self.tokens -= amount
                return True
            
            # Need to wait
            deficit = amount - self.tokens
            wait_time = deficit / self.rate
            
            if timeout is not None and wait_time > timeout:
                return False  # Would wait too long
            
            # Release lock while waiting
            pass  # Would implement wait and retry
        
        await asyncio.sleep(wait_time)
        return await self.consume(amount, timeout=0)  # Retry, should succeed
```

#### 6.1.2 Concurrent Specification Processing

```python
# core/ai_agent_parallel.py (continued) - Concurrent Spec Processing

class ConcurrentSpecProcessor:
    """
    Process multiple specifications or tasks in parallel with dependency awareness.
    
    Respects task dependencies while maximizing parallelism.
    """
    
    def __init__(self, agent_pool: AgentPool, spec_manager: Any):
        self.agent_pool = agent_pool
        self.spec_manager = spec_manager
    
    async def process_specification(
        self,
        spec_id: str,
        max_parallel_tasks: int = 3
    ) -> dict[str, Any]:
        """
        Execute all tasks in specification with optimal parallelism.
        
        Respects dependencies, runs ready tasks in parallel up to limit.
        """
        from core.spec import topological_sort, TaskStatus
        
        spec = self.spec_manager.get(spec_id)
        if not spec:
            raise ValueError(f"Specification not found: {spec_id}")
        
        # Build dependency graph
        graph = self.spec_manager.get_task_graph(spec_id)
        
        # Track task states
        task_futures: dict[str, asyncio.Future] = {}
        task_results: dict[str, Any] = {}
        
        # Process until all complete
        pending = set(graph.keys())
        completed = set()
        failed = set()
        
        while pending:
            # Find ready tasks (all dependencies completed)
            ready = [
                t for t in pending
                if graph[t].issubset(completed)
            ][:max_parallel_tasks]  # Limit parallelism
            
            if not ready and pending:
                # Deadlock or waiting on in-flight tasks
                await asyncio.sleep(0.1)
                continue
            
            # Submit ready tasks
            for task_id in ready:
                task = next((t for t in spec.tasks if t.id == task_id), None)
                if not task:
                    continue
                
                # Update status
                self.spec_manager.update(
                    spec_id,
                    tasks=[
                        {**t.dict(), "status": TaskStatus.ASSIGNED if t.id == task_id else t.status}
                        for t in spec.tasks
                    ]
                )
                
                # Submit to agent pool
                future = await self.agent_pool.submit(
                    task_id=task_id,
                    coro=lambda t=task: self._execute_task(spec, t),
                    priority=TaskPriority.NORMAL,
                    estimated_tokens=5000  # Would be task-specific
                )
                task_futures[task_id] = future
                pending.remove(task_id)
            
            # Check completed futures
            done = []
            for task_id, future in list(task_futures.items()):
                if future.done():
                    done.append(task_id)
                    try:
                        result = future.result()
                        task_results[task_id] = result
                        completed.add(task_id)
                        
                        # Update task status
                        self._update_task_status(spec_id, task_id, TaskStatus.COMPLETED)
                        
                    except Exception as e:
                        task_results[task_id] = e
                        failed.add(task_id)
                        self._update_task_status(spec_id, task_id, TaskStatus.FAILED)
            
            for task_id in done:
                del task_futures[task_id]
            
            # Brief yield to allow progress
            if task_futures:
                await asyncio.wait(
                    [asyncio.wrap_future(f) for f in task_futures.values()],
                    return_when=asyncio.FIRST_COMPLETED,
                    timeout=0.1
                )
        
        return {
            "completed": list(completed),
            "failed": list(failed),
            "results": task_results
        }
    
    async def _execute_task(self, spec: Specification, task: Any) -> Any:
        """Execute single task with full context."""
        # Would integrate with CodeGenerator
        from core.code_generator import CodeGenerator, GenerationContext
        
        ctx = GenerationContext(
            specification=spec,
            current_task=task,
            codebase_root=Path(".")  # Would be configured
        )
        
        generator = CodeGenerator(
            agent=self.agent_pool.agents.get("default"),  # Would select appropriately
            codebase_context=lambda: "..."  # Would provide real context
        )
        
        return await generator.generate(ctx)
    
    def _update_task_status(self, spec_id: str, task_id: str, status: Any) -> None:
        """Update task status in specification."""
        spec = self.spec_manager.get(spec_id)
        if not spec:
            return
        
        updated_tasks = []
        for t in spec.tasks:
            if t.id == task_id:
                updated_tasks.append({**t.dict(), "status": status})
            else:
                updated_tasks.append(t.dict())
        
        self.spec_manager.update(spec_id, tasks=updated_tasks)
```

#### 6.1.3 Connection Pooling and Rate Limit Management

```python
# core/ai_agent_parallel.py (continued) - Connection Management

import httpx
from contextlib import asynccontextmanager


class PooledHTTPClient:
    """
    HTTP client with connection pooling and automatic retries.
    
    Optimized for AI API usage patterns: long-lived connections,
    occasional large payloads, retry on transient failures.
    """
    
    def __init__(
        self,
        base_url: str,
        headers: dict[str, str],
        pool_size: int = 10,
        keepalive_expiry: float = 30.0
    ):
        self.base_url = base_url
        self.headers = headers
        
        # Configure connection pool
        limits = httpx.Limits(
            max_connections=pool_size,
            max_keepalive_connections=pool_size,
            keepalive_expiry=keepalive_expiry
        )
        
        timeout = httpx.Timeout(
            connect=10.0,
            read=60.0,
            write=10.0,
            pool=5.0
        )
        
        self.client = httpx.AsyncClient(
            base_url=base_url,
            headers=headers,
            limits=limits,
            timeout=timeout,
            http2=True  # Enable HTTP/2 for multiplexing
        )
        
        self._request_count = 0
        self._error_count = 0
    
    async def request(
        self,
        method: str,
        path: str,
        **kwargs: Any
    ) -> httpx.Response:
        """Make request with metrics and error handling."""
        self._request_count += 1
        
        try:
            response = await self.client.request(method, path, **kwargs)
            response.raise_for_status()
            return response
            
        except httpx.HTTPStatusError as e:
            self._error_count += 1
            raise
        except httpx.NetworkError as e:
            self._error_count += 1
            # Could implement retry here
            raise
    
    async def close(self) -> None:
        """Close all connections."""
        await self.client.aclose()
    
    def get_metrics(self) -> dict[str, Any]:
        """Return connection metrics."""
        return {
            "requests": self._request_count,
            "errors": self._error_count,
            "error_rate": self._error_count / max(self._request_count, 1),
            "pool_size": self.client.limits.max_connections,
        }


class RateLimitHandler:
    """
    Intelligent handling of API rate limits.
    
    Parses rate limit headers, implements backoff, distributes
    requests across multiple keys if available.
    """
    
    def __init__(self, api_keys: Optional[list[str]] = None):
        self.api_keys = api_keys or []
        self._key_index = 0
        
        # Per-key rate limit state
        self._key_state: dict[str, dict[str, Any]] = {
            key: {
                "remaining": float('inf'),
                "reset_time": 0,
                "in_flight": 0
            }
            for key in self.api_keys
        } if api_keys else {"default": {"remaining": float('inf'), "reset_time": 0, "in_flight": 0}}
    
    def get_key(self) -> Optional[str]:
        """Select best available API key."""
        if not self.api_keys:
            return None
        
        # Find key with most remaining quota
        best_key = None
        best_remaining = -1
        
        for key, state in self._key_state.items():
            if state["remaining"] > best_remaining and state["in_flight"] < 5:
                best_remaining = state["remaining"]
                best_key = key
        
        if best_key:
            self._key_state[best_key]["in_flight"] += 1
        
        return best_key
    
    def release_key(self, key: Optional[str], headers: dict[str, str]) -> None:
        """Update state after request completion."""
        key = key or "default"
        
        if key in self._key_state:
            self._key_state[key]["in_flight"] -= 1
            
            # Parse rate limit headers
            remaining = headers.get("x-ratelimit-remaining")
            if remaining:
                self._key_state[key]["remaining"] = int(remaining)
            
            reset = headers.get("x-ratelimit-reset")
            if reset:
                self._key_state[key]["reset_time"] = int(reset)
    
    def get_backoff(self, key: Optional[str] = None) -> float:
        """Calculate required backoff for key."""
        key = key or "default"
        state = self._key_state.get(key, {})
        
        if state.get("remaining", 0) > 0:
            return 0
        
        reset_time = state.get("reset_time", 0)
        if reset_time:
            return max(0, reset_time - asyncio.get_event_loop().time())
        
        return 1.0  # Default backoff
```

### 6.2 Caching and Memoization Strategies

#### 6.2.1 Embedding-Based Semantic Cache for Similar Prompts

```python
# core/cache.py - Semantic Caching

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import numpy as np
from sentence_transformers import SentenceTransformer


@dataclass
class CacheEntry:
    """Single cached result with metadata."""
    key: str  # Hash of normalized prompt
    prompt_embedding: np.ndarray
    result: Any
    token_usage: int
    created_at: float
    access_count: int = 0
    last_accessed: float = 0.0


class SemanticCache:
    """
    Cache for AI responses based on semantic similarity of prompts.
    
    Avoids redundant API calls when semantically equivalent prompts
    are submitted, even with different surface forms.
    """
    
    SIMILARITY_THRESHOLD = 0.95  # Cosine similarity for cache hit
    
    def __init__(
        self,
        embedding_model: str = "all-MiniLM-L6-v2",
        storage_path: Optional[Path] = None,
        max_entries: int = 10000
    ):
        self.model = SentenceTransformer(embedding_model)
        self.storage_path = storage_path
        self.max_entries = max_entries
        
        self._entries: dict[str, CacheEntry] = {}
        self._embeddings: Optional[np.ndarray] = None  # Matrix for fast search
        self._keys: list[str] = []  # Parallel list to embeddings
        
        if storage_path:
            self._load()
    
    def _normalize_prompt(self, prompt: str) -> str:
        """Normalize prompt for consistent embedding."""
        # Remove extra whitespace
        normalized = " ".join(prompt.split())
        # Lowercase (optional - depends on model)
        # normalized = normalized.lower()
        return normalized
    
    def _compute_hash(self, normalized_prompt: str) -> str:
        """Compute deterministic hash for exact lookup."""
        return hashlib.sha256(normalized_prompt.encode()).hexdigest()[:16]
    
    async def get(self, prompt: str) -> Optional[CacheEntry]:
        """
        Check cache for semantically similar prompt.
        
        First checks exact hash match, then semantic similarity.
        """
        normalized = self._normalize_prompt(prompt)
        key = self._compute_hash(normalized)
        
        # Exact match
        if key in self._entries:
            entry = self._entries[key]
            entry.access_count += 1
            entry.last_accessed = asyncio.get_event_loop().time()
            return entry
        
        # Semantic similarity search
        if len(self._entries) > 0:
            prompt_embedding = self.model.encode(normalized, convert_to_numpy=True)
            
            # Compute similarities
            similarities = np.dot(self._embeddings, prompt_embedding)
            best_idx = np.argmax(similarities)
            best_similarity = similarities[best_idx]
            
            if best_similarity >= self.SIMILARITY_THRESHOLD:
                hit_key = self._keys[best_idx]
                entry = self._entries[hit_key]
                entry.access_count += 1
                entry.last_accessed = asyncio.get_event_loop().time()
                
                # Log semantic hit
                logger.info("cache:semantic_hit", 
                           similarity=float(best_similarity),
                           original_key=hit_key,
                           query_key=key)
                
                return entry
        
        return None
    
    async def put(self, prompt: str, result: Any, token_usage: int) -> None:
        """Store result in cache."""
        normalized = self._normalize_prompt(prompt)
        key = self._compute_hash(normalized)
        
        # Compute embedding
        embedding = self.model.encode(normalized, convert_to_numpy=True)
        
        # Create entry
        entry = CacheEntry(
            key=key,
            prompt_embedding=embedding,
            result=result,
            token_usage=token_usage,
            created_at=asyncio.get_event_loop().time(),
            last_accessed=asyncio.get_event_loop().time()
        )
        
        # Evict if at capacity
        if len(self._entries) >= self.max_entries:
            self._evict_lru()
        
        # Store
        self._entries[key] = entry
        self._update_index()
        
        # Persist if configured
        if self.storage_path:
            self._save()
    
    def _update_index(self) -> None:
        """Rebuild embedding matrix for fast search."""
        if not self._entries:
            self._embeddings = None
            self._keys = []
            return
        
        self._keys = list(self._entries.keys())
        self._embeddings = np.stack([
            self._entries[k].prompt_embedding 
            for k in self._keys
        ])
        # Normalize for cosine similarity
        self._embeddings = self._embeddings / np.linalg.norm(
            self._embeddings, axis=1, keepdims=True
        )
    
    def _evict_lru(self) -> None:
        """Remove least recently used entry."""
        if not self._entries:
            return
        
        lru_key = min(
            self._entries.keys(),
            key=lambda k: (
                self._entries[k].access_count,
                self._entries[k].last_accessed
            )
        )
        del self._entries[lru_key]
    
    def get_stats(self) -> dict[str, Any]:
        """Return cache statistics."""
        if not self._entries:
            return {"entries": 0}
        
        total_usage = sum(e.token_usage for e in self._entries.values())
        total_accesses = sum(e.access_count for e in self._entries.values())
        
        return {
            "entries": len(self._entries),
            "total_token_usage_stored": total_usage,
            "total_accesses": total_accesses,
            "estimated_savings": total_usage * (total_accesses / len(self._entries) - 1)
            if self._entries else 0
        }
    
    def _save(self) -> None:
        """Persist cache to disk."""
        if not self.storage_path:
            return
        
        # Serialize embeddings separately (numpy)
        data = {
            "entries": {
                k: {
                    "result": e.result,
                    "token_usage": e.token_usage,
                    "created_at": e.created_at,
                    "access_count": e.access_count,
                    "last_accessed": e.last_accessed
                }
                for k, e in self._entries.items()
            },
            "embeddings": {
                k: e.prompt_embedding.tobytes()
                for k, e in self._entries.items()
            }
        }
        
        self.storage_path.write_text(json.dumps(data, default=str))
    
    def _load(self) -> None:
        """Load cache from disk."""
        if not self.storage_path or not self.storage_path.exists():
            return
        
        # Would implement deserialization
        pass
```

#### 6.2.2 AST Hash Cache for Incremental Rebuilds

```python
# core/cache.py (continued) - AST-Based Caching

import ast


class ASTHashCache:
    """
    Cache for code analysis results based on AST structure.
    
    Enables incremental rebuilds: only re-analyze files that
    have structurally changed, not just textually changed.
    """
    
    def __init__(self, storage_path: Optional[Path] = None):
        self.storage_path = storage_path
        self._hashes: dict[str, str] = {}  # file path -> AST hash
        self._results: dict[str, Any] = {}  # file path -> analysis result
    
    def compute_ast_hash(self, source: str) -> str:
        """
        Compute hash of AST structure, ignoring formatting.
        
        Two files with same AST but different formatting
        will have identical hashes.
        """
        try:
            tree = ast.parse(source)
        except SyntaxError:
            # Fall back to text hash for invalid syntax
            return hashlib.sha256(source.encode()).hexdigest()
        
        # Normalize AST: sort fields, ignore line numbers
        normalized = self._normalize_ast(tree)
        
        # Hash the normalized representation
        return hashlib.sha256(
            json.dumps(normalized, sort_keys=True).encode()
        ).hexdigest()
    
    def _normalize_ast(self, node: ast.AST) -> dict[str, Any]:
        """Convert AST to normalized serializable form."""
        if isinstance(node, ast.AST):
            result = {"_type": node.__class__.__name__}
            for field, value in ast.iter_fields(node):
                # Skip location info
                if field in ("lineno", "col_offset", "end_lineno", "end_col_offset"):
                    continue
                result[field] = self._normalize_ast(value)
            return result
        
        if isinstance(node, list):
            # Sort lists where order doesn't matter (e.g., function body matters,
            # but import order might not - but we preserve for simplicity)
            return [self._normalize_ast(item) for item in node]
        
        # Primitive value
        return node
    
    def get(self, file_path: str, current_source: str) -> Optional[Any]:
        """Get cached result if AST unchanged."""
        current_hash = self.compute_ast_hash(current_source)
        
        if self._hashes.get(file_path) == current_hash:
            return self._results.get(file_path)
        
        return None
    
    def put(self, file_path: str, source: str, result: Any) -> None:
        """Store result with AST hash."""
        ast_hash = self.compute_ast_hash(source)
        
        self._hashes[file_path] = ast_hash
        self._results[file_path] = result
    
    def invalidate(self, file_path: str) -> None:
        """Remove entry from cache."""
        self._hashes.pop(file_path, None)
        self._results.pop(file_path, None)
    
    def get_stats(self) -> dict[str, Any]:
        """Return cache statistics."""
        return {
            "entries": len(self._hashes),
            "hit_rate": None  # Would track with counter
        }
```

#### 6.2.3 Distributed Cache Backend (Redis/Valkey)

```python
# core/cache.py (continued) - Distributed Caching

import pickle


class DistributedCache:
    """
    Redis/Valkey-backed cache for multi-machine deployments.
    
    Enables cache sharing across developer team or CI runners.
    """
    
    def __init__(
        self,
        redis_url: str = "redis://localhost:6379",
        key_prefix: str = "openkode:",
        default_ttl: int = 86400  # 24 hours
    ):
        try:
            import redis.asyncio as redis
            self.client = redis.from_url(redis_url)
            self.available = True
        except ImportError:
            self.client = None
            self.available = False
        
        self.key_prefix = key_prefix
        self.default_ttl = default_ttl
    
    def _make_key(self, key: str) -> str:
        """Add prefix to key."""
        return f"{self.key_prefix}{key}"
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from distributed cache."""
        if not self.available:
            return None
        
        try:
            data = await self.client.get(self._make_key(key))
            if data:
                return pickle.loads(data)
        except Exception as e:
            logger.warning("distributed_cache:get_failed", error=str(e))
        
        return None
    
    async def put(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None
    ) -> bool:
        """Store value in distributed cache."""
        if not self.available:
            return False
        
        try:
            serialized = pickle.dumps(value)
            await self.client.setex(
                self._make_key(key),
                ttl or self.default_ttl,
                serialized
            )
            return True
        except Exception as e:
            logger.warning("distributed_cache:put_failed", error=str(e))
            return False
    
    async def invalidate(self, pattern: str) -> int:
        """Invalidate keys matching pattern."""
        if not self.available:
            return 0
        
        try:
            keys = await self.client.keys(self._make_key(pattern))
            if keys:
                return await self.client.delete(*keys)
        except Exception as e:
            logger.warning("distributed_cache:invalidate_failed", error=str(e))
        
        return 0
    
    async def get_stats(self) -> dict[str, Any]:
        """Return cache statistics."""
        if not self.available:
            return {"available": False}
        
        try:
            info = await self.client.info("memory")
            return {
                "available": True,
                "used_memory": info.get("used_memory_human", "unknown"),
                "key_count": await self.client.dbsize(),
            }
        except Exception as e:
            return {"available": False, "error": str(e)}
```

### 6.3 Intelligent Context Pruning

#### 6.3.1 Relevance Scoring for Codebase Symbols

```python
# core/context_pruning.py - Relevance Scoring

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

import numpy as np


@dataclass
class ScoredSymbol:
    """Symbol with relevance score for context inclusion."""
    name: str
    symbol_type: str  # "function", "class", "variable", "module"
    file_path: str
    line_number: int
    
    # Relevance components
    text_similarity: float = 0.0      # Embedding similarity to query
    structural_proximity: float = 0.0  # Distance in call graph
    recency: float = 0.0               # Time since last modification
    frequency: float = 0.0             # Usage frequency in codebase
    
    # Combined score
    final_score: float = 0.0
    
    def compute_final(self, weights: Optional[dict[str, float]] = None) -> float:
        """Compute weighted combination of relevance components."""
        w = weights or {
            "text_similarity": 0.4,
            "structural_proximity": 0.3,
            "recency": 0.2,
            "frequency": 0.1
        }
        
        self.final_score = (
            w["text_similarity"] * self.text_similarity +
            w["structural_proximity"] * self.structural_proximity +
            w["recency"] * self.recency +
            w["frequency"] * self.frequency
        )
        return self.final_score


class RelevanceScorer:
    """
    Score codebase symbols for relevance to current task.
    
    Combines multiple signals to identify most useful context.
    """
    
    def __init__(
        self,
        embedding_model: Any,  # SentenceTransformer or similar
        codebase_index: Any    # Ingested codebase with graph structure
    ):
        self.embedding_model = embedding_model
        self.codebase = codebase_index
        
        # Cache for query embeddings
        self._query_cache: dict[str, np.ndarray] = {}
    
    def score_for_task(
        self,
        task_description: str,
        specification: Optional[Any] = None,
        already_included: Optional[set[str]] = None
    ) -> list[ScoredSymbol]:
        """
        Score all symbols for relevance to given task.
        
        Returns sorted list, highest relevance first.
        """
        # Get or compute query embedding
        if task_description not in self._query_cache:
            self._query_cache[task_description] = self.embedding_model.encode(
                task_description,
                convert_to_numpy=True
            )
        query_embedding = self._query_cache[task_description]
        
        scored = []
        
        for symbol in self.codebase.get_all_symbols():
            # Skip already included
            if already_included and symbol.unique_id in already_included:
                continue
            
            scorer = ScoredSymbol(
                name=symbol.name,
                symbol_type=symbol.type,
                file_path=symbol.file_path,
                line_number=symbol.line_number
            )
            
            # Text similarity
            if symbol.embedding is not None:
                scorer.text_similarity = float(
                    np.dot(query_embedding, symbol.embedding) /
                    (np.linalg.norm(query_embedding) * np.linalg.norm(symbol.embedding))
                )
            
            # Structural proximity (would use call graph)
            scorer.structural_proximity = self._compute_structural_proximity(
                symbol, already_included or set()
            )
            
            # Recency
            scorer.recency = self._compute_recency(symbol.last_modified)
            
            # Frequency
            scorer.frequency = min(1.0, symbol.reference_count / 100)
            
            # Final score
            scorer.compute_final()
            scored.append(scorer)
        
        # Sort by final score
        scored.sort(key=lambda s: s.final_score, reverse=True)
        return scored
    
    def _compute_structural_proximity(
        self,
        symbol: Any,
        included: set[str]
    ) -> float:
        """Compute proximity to already-included symbols."""
        if not included:
            return 0.5  # Neutral when no context yet
        
        # Find minimum distance in call graph
        min_distance = float('inf')
        for included_id in included:
            distance = self.codebase.graph_distance(symbol.unique_id, included_id)
            if distance is not None:
                min_distance = min(min_distance, distance)
        
        if min_distance == float('inf'):
            return 0.0
        
        # Convert distance to proximity score (closer = higher)
        return 1.0 / (1.0 + min_distance)
    
    def _compute_recency(self, last_modified: float) -> float:
        """Convert timestamp to recency score."""
        import time
        
        age_seconds = time.time() - last_modified
        
        # Exponential decay: 1.0 at 0, ~0.5 at 1 day, ~0.1 at 1 week
        day_seconds = 86400
        return np.exp(-age_seconds / day_seconds)
    
    def select_context(
        self,
        task_description: str,
        token_budget: int,
        tokens_per_symbol: Callable[[ScoredSymbol], int],
        already_included: Optional[set[str]] = None
    ) -> list[ScoredSymbol]:
        """
        Select optimal set of symbols within token budget.
        
        Uses greedy selection with budget constraint.
        """
        scored = self.score_for_task(task_description, already_included=already_included)
        
        selected = []
        remaining_budget = token_budget
        
        for symbol in scored:
            cost = tokens_per_symbol(symbol)
            
            if cost <= remaining_budget:
                selected.append(symbol)
                remaining_budget -= cost
            
            if remaining_budget < 100:  # Minimum useful chunk
                break
        
        return selected
```

#### 6.3.2 Hierarchical Summarization for Large Codebases

```python
# core/context_pruning.py (continued) - Hierarchical Summarization

class HierarchicalSummarizer:
    """
    Create multi-level summaries of code for context compression.
    
    Enables inclusion of large codebases by representing distant
    code at higher abstraction levels.
    """
    
    SUMMARY_LEVELS = ["full", "signature", "interface", "description"]
    
    def __init__(self, agent_pool: AgentPool):
        self.agent_pool = agent_pool
        self._summary_cache: dict[tuple[str, str], str] = {}  # (symbol_id, level) -> summary
    
    async def summarize(
        self,
        symbol: Any,
        level: str = "signature",
        force_refresh: bool = False
    ) -> str:
        """
        Get or generate summary at specified abstraction level.
        
        Levels (from most to least detailed):
        - full: Complete implementation
        - signature: Type signatures and docstrings only
        - interface: Public methods and their purposes
        - description: Natural language description of purpose
        """
        cache_key = (symbol.unique_id, level)
        
        if not force_refresh and cache_key in self._summary_cache:
            return self._summary_cache[cache_key]
        
        # Generate appropriate summary
        if level == "full":
            summary = symbol.source_code
        
        elif level == "signature":
            summary = self._extract_signatures(symbol)
        
        elif level == "interface":
            summary = await self._generate_interface_summary(symbol)
        
        elif level == "description":
            summary = await self._generate_description(symbol)
        
        else:
            raise ValueError(f"Unknown summary level: {level}")
        
        self._summary_cache[cache_key] = summary
        return summary
    
    def _extract_signatures(self, symbol: Any) -> str:
        """Extract type signatures without implementation."""
        # Would use AST to extract signatures
        # Simplified: return first N lines (typically imports + signature)
        lines = symbol.source_code.split("\n")
        signature_lines = []
        
        for line in lines:
            signature_lines.append(line)
            # Stop at first non-decorator, non-docstring line with body
            stripped = line.strip()
            if stripped and not stripped.startswith(("@", "#", '"', "'")):
                if ":" in stripped and not stripped.endswith(":"):
                    # Has type annotation and default, likely complete
                    continue
                if stripped.endswith(":"):
                    # End of signature
                    break
        
        return "\n".join(signature_lines) + "\n    ..."
    
    async def _generate_interface_summary(self, symbol: Any) -> str:
        """Generate AI summary of public interface."""
        prompt = f"""
        Summarize the public interface of this {symbol.type}:
        
        ```{symbol.language}
        {symbol.source_code[:2000]}  # Truncated for prompt
        ```
        
        List: public methods/functions, their parameters and return types,
        and one-line description of each. Omit private members (starting with _).
        """
        
        # Would submit to agent pool
        # Simplified: return placeholder
        return f"# {symbol.name}\n# Public interface summary would be generated by AI"
    
    async def _generate_description(self, symbol: Any) -> str:
        """Generate one-line natural language description."""
        # Use cached or generate
        cache_key = (symbol.unique_id, "description")
        
        if cache_key in self._summary_cache:
            return self._summary_cache[cache_key]
        
        prompt = f"Describe in one sentence what this {symbol.type} does: {symbol.name}"
        # Would use agent for generation
        
        description = f"{symbol.type} '{symbol.name}' from {symbol.file_path}"
        self._summary_cache[cache_key] = description
        return description
    
    def build_hierarchical_context(
        self,
        center_symbol: Any,
        max_depth: int = 3,
        token_budget: int = 8000
    ) -> dict[str, str]:
        """
        Build context with decreasing detail by distance from center.
        
        Center symbol at full detail, neighbors at signature,
        distant symbols at description level.
        """
        context = {}
        remaining_budget = token_budget
        
        # Center at full detail
        center_full = self.summarize(center_symbol, "full")
        context[center_symbol.unique_id] = center_full
        remaining_budget -= self._estimate_tokens(center_full)
        
        # BFS for neighbors
        from collections import deque
        queue = deque([(center_symbol, 0)])
        visited = {center_symbol.unique_id}
        
        while queue and remaining_budget > 500:
            symbol, depth = queue.popleft()
            
            # Determine detail level by distance
            if depth == 0:
                continue  # Already handled
            elif depth == 1:
                level = "signature"
            else:
                level = "description"
            
            # Get summary
            summary = self.summarize(symbol, level)
            cost = self._estimate_tokens(summary)
            
            if cost <= remaining_budget:
                context[symbol.unique_id] = summary
                remaining_budget -= cost
            
            # Queue neighbors if within depth
            if depth < max_depth:
                for neighbor in self._get_related_symbols(symbol):
                    if neighbor.unique_id not in visited:
                        visited.add(neighbor.unique_id)
                        queue.append((neighbor, depth + 1))
        
        return context
    
    def _estimate_tokens(self, text: str) -> int:
        """Rough token estimation for budgeting."""
        # ~4 characters per token for code
        return len(text) // 4
    
    def _get_related_symbols(self, symbol: Any) -> list[Any]:
        """Get symbols related through calls, inheritance, etc."""
        # Would use codebase graph
        return []
```

#### 6.3.3 Active Specification Window Management

```python
# core/context_pruning.py (continued) - Window Management

class ActiveWindowManager:
    """
    Manage the "active window" of specification context.
    
    Ensures most relevant content is in context while staying
    within token limits, with intelligent eviction.
    """
    
    def __init__(
        self,
        max_tokens: int = 128000,  # Claude 3 context
        reserved_tokens: int = 8000  # For response and overhead
    ):
        self.max_tokens = max_tokens
        self.reserved_tokens = reserved_tokens
        self.available_tokens = max_tokens - reserved_tokens
        
        # Window contents
        self._specification: Optional[str] = None
        self._spec_tokens: int = 0
        
        self._task: Optional[str] = None
        self._task_tokens: int = 0
        
        self._code_context: dict[str, str] = {}  # path -> content
        self._code_tokens: int = 0
        
        self._history: list[tuple[str, int]] = []  # (content, tokens)
        self._history_tokens: int = 0
    
    def set_specification(self, spec_text: str) -> bool:
        """Set active specification, returns True if fits."""
        tokens = self._estimate_tokens(spec_text)
        
        if tokens > self.available_tokens * 0.3:  # Max 30% for spec
            # Need to summarize or reject
            return False
        
        self._specification = spec_text
        self._spec_tokens = tokens
        return True
    
    def set_task(self, task_text: str) -> bool:
        """Set current task context."""
        tokens = self._estimate_tokens(task_text)
        
        # Evict history if needed
        while self._used_tokens() + tokens > self.available_tokens:
            if not self._evict_least_important():
                return False
        
        self._task = task_text
        self._task_tokens = tokens
        return True
    
    def add_code(self, file_path: str, content: str, priority: float = 1.0) -> bool:
        """Add code file to context window."""
        tokens = self._estimate_tokens(content)
        
        # Check if already present
        if file_path in self._code_context:
            old_tokens = self._estimate_tokens(self._code_context[file_path])
            self._code_tokens -= old_tokens
        
        # Make room if needed
        while self._used_tokens() + tokens > self.available_tokens:
            if not self._evict_least_important():
                # Can't make enough room
                self._code_tokens += old_tokens if file_path in self._code_context else 0
                return False
        
        self._code_context[file_path] = content
        self._code_tokens += tokens
        return True
    
    def add_to_history(self, message: str) -> None:
        """Add conversation history, with eviction if needed."""
        tokens = self._estimate_tokens(message)
        
        # Evict oldest history first
        while self._used_tokens() + tokens > self.available_tokens * 0.2:  # Max 20% history
            if self._history:
                old_content, old_tokens = self._history.pop(0)
                self._history_tokens -= old_tokens
            else:
                break
        
        self._history.append((message, tokens))
        self._history_tokens += tokens
    
    def _used_tokens(self) -> int:
        """Calculate currently used tokens."""
        return (
            self._spec_tokens +
            self._task_tokens +
            self._code_tokens +
            self._history_tokens
        )
    
    def _evict_least_important(self) -> bool:
        """Remove lowest priority content to free tokens."""
        # Priority: history < code < task < specification
        
        if self._history:
            # Evict oldest history
            _, tokens = self._history.pop(0)
            self._history_tokens -= tokens
            return True
        
        if len(self._code_context) > 1:
            # Evict code file with lowest relevance score
            # Simplified: evict largest file
            largest = max(
                self._code_context.items(),
                key=lambda x: len(x[1])
            )
            del self._code_context[largest[0]]
            self._code_tokens -= self._estimate_tokens(largest[1])
            return True
        
        return False  # Can't evict more
    
    def build_prompt(self) -> str:
        """Assemble full prompt from window contents."""
        parts = []
        
        if self._specification:
            parts.append(f"<specification>\n{self._specification}\n</specification>")
        
        if self._task:
            parts.append(f"<current_task>\n{self._task}\n</current_task>")
        
        if self._code_context:
            parts.append("<code_context>")
            for path, content in sorted(self._code_context.items()):
                parts.append(f"<file path=\"{path}\">\n{content}\n</file>")
            parts.append("</code_context>")
        
        if self._history:
            parts.append("<conversation_history>")
            for msg in [h[0] for h in self._history]:
                parts.append(msg)
            parts.append("</conversation_history>")
        
        return "\n\n".join(parts)
    
    def _estimate_tokens(self, text: str) -> int:
        """Estimate token count for budgeting."""
        return len(text) // 4  # Rough approximation
    
    def get_stats(self) -> dict[str, Any]:
        """Return window utilization statistics."""
        used = self._used_tokens()
        return {
            "max_tokens": self.max_tokens,
            "available_tokens": self.available_tokens,
            "used_tokens": used,
            "utilization": used / self.available_tokens,
            "breakdown": {
                "specification": self._spec_tokens,
                "task": self._task_tokens,
                "code": self._code_tokens,
                "history": self._history_tokens
            },
            "code_files": len(self._code_context)
        }
```

### 6.4 Observability and Performance Tuning

#### 6.4.1 Structured Logging with OpenTelemetry

```python
# core/observability.py - Observability Implementation

from __future__ import annotations

import time
from contextlib import contextmanager
from typing import Any, Optional

import structlog


# Configure structlog for structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)


class OpenTelemetryTracer:
    """
    Distributed tracing for OpenKode operations.
    
    Enables performance analysis and debugging across
    specification-to-code pipeline.
    """
    
    def __init__(self, service_name: str = "openkode"):
        self.service_name = service_name
        self._spans: list[dict[str, Any]] = []
        self._active_spans: dict[str, dict[str, Any]] = {}
    
    def start_span(
        self,
        name: str,
        parent_id: Optional[str] = None,
        attributes: Optional[dict[str, Any]] = None
    ) -> str:
        """Start a new trace span."""
        import uuid
        
        span_id = str(uuid.uuid4())[:16]
        span = {
            "span_id": span_id,
            "parent_id": parent_id,
            "name": name,
            "start_time": time.time_ns(),
            "attributes": attributes or {},
            "events": []
        }
        
        self._active_spans[span_id] = span
        return span_id
    
    def add_event(
        self,
        span_id: str,
        name: str,
        attributes: Optional[dict[str, Any]] = None
    ) -> None:
        """Add event to active span."""
        if span_id not in self._active_spans:
            return
        
        self._active_spans[span_id]["events"].append({
            "name": name,
            "timestamp": time.time_ns(),
            "attributes": attributes or {}
        })
    
    def end_span(
        self,
        span_id: str,
        status: str = "ok",
        status_message: Optional[str] = None
    ) -> dict[str, Any]:
        """End span and return completed trace."""
        if span_id not in self._active_spans:
            raise ValueError(f"Unknown span: {span_id}")
        
        span = self._active_spans.pop(span_id)
        span["end_time"] = time.time_ns()
        span["duration_ms"] = (span["end_time"] - span["start_time"]) / 1_000_000
        span["status"] = status
        span["status_message"] = status_message
        
        self._spans.append(span)
        return span
    
    @contextmanager
    def span_context(self, name: str, **attributes: Any):
        """Context manager for span lifecycle."""
        span_id = self.start_span(name, attributes=attributes)
        try:
            yield span_id
            self.end_span(span_id, status="ok")
        except Exception as e:
            self.end_span(span_id, status="error", status_message=str(e))
            raise
    
    def get_trace(self, root_span_id: str) -> list[dict[str, Any]]:
        """Get all spans in trace starting from root."""
        # Build tree from flat spans
        span_map = {s["span_id"]: s for s in self._spans}
        span_map.update(self._active_spans)
        
        if root_span_id not in span_map:
            return []
        
        # Collect all descendants
        trace = []
        to_process = [root_span_id]
        
        while to_process:
            current_id = to_process.pop()
            if current_id in span_map:
                span = span_map[current_id]
                trace.append(span)
                # Find children
                for sid, s in span_map.items():
                    if s.get("parent_id") == current_id:
                        to_process.append(sid)
        
        # Sort by start time
        trace.sort(key=lambda s: s["start_time"])
        return trace
    
    def export_spans(self) -> list[dict[str, Any]]:
        """Export all completed spans for external analysis."""
        return self._spans.copy()


# Global tracer instance
tracer = OpenTelemetryTracer()
```

#### 6.4.2 Latency Breakdown by Pipeline Stage

```python
# core/observability.py (continued) - Performance Metrics

from dataclasses import dataclass, field
from typing import Callable


@dataclass
class PipelineMetrics:
    """Aggregated metrics for specification-to-code pipeline."""
    
    # Stage timings (milliseconds)
    ingestion_ms: list[float] = field(default_factory=list)
    planning_ms: list[float] = field(default_factory=list)
    context_building_ms: list[float] = field(default_factory=list)
    generation_ms: list[float] = field(default_factory=list)
    verification_ms: list[float] = field(default_factory=list)
    
    # Token usage
    prompt_tokens: list[int] = field(default_factory=list)
    completion_tokens: list[int] = field(default_factory=list)
    
    # Quality metrics
    verification_pass_rate: list[bool] = field(default_factory=list)
    retry_count: list[int] = field(default_factory=list)
    
    def record_run(
        self,
        ingestion: float,
        planning: float,
        context_building: float,
        generation: float,
        verification: float,
        tokens: tuple[int, int],
        passed: bool,
        retries: int
    ) -> None:
        """Record single pipeline execution."""
        self.ingestion_ms.append(ingestion)
        self.planning_ms.append(planning)
        self.context_building_ms.append(context_building)
        self.generation_ms.append(generation)
        self.verification_ms.append(verification)
        self.prompt_tokens.append(tokens[0])
        self.completion_tokens.append(tokens[1])
        self.verification_pass_rate.append(passed)
        self.retry_count.append(retries)
    
    def get_summary(self) -> dict[str, Any]:
        """Generate statistical summary."""
        import statistics
        
        def stats(values: list[float]) -> dict[str, float]:
            if not values:
                return {"count": 0}
            return {
                "count": len(values),
                "mean": statistics.mean(values),
                "median": statistics.median(values),
                "stdev": statistics.stdev(values) if len(values) > 1 else 0,
                "min": min(values),
                "max": max(values),
                "p95": sorted(values)[int(len(values) * 0.95)] if values else 0
            }
        
        total_time = [
            i + p + c + g + v
            for i, p, c, g, v in zip(
                self.ingestion_ms,
                self.planning_ms,
                self.context_building_ms,
                self.generation_ms,
                self.verification_ms
            )
        ]
        
        return {
            "total_pipeline_time_ms": stats(total_time),
            "stages": {
                "ingestion_ms": stats(self.ingestion_ms),
                "planning_ms": stats(self.planning_ms),
                "context_building_ms": stats(self.context_building_ms),
                "generation_ms": stats(self.generation_ms),
                "verification_ms": stats(self.verification_ms)
            },
            "token_usage": {
                "prompt": stats([float(t) for t in self.prompt_tokens]),
                "completion": stats([float(t) for t in self.completion_tokens])
            },
            "quality": {
                "pass_rate": sum(self.verification_pass_rate) / max(len(self.verification_pass_rate), 1),
                "avg_retries": statistics.mean(self.retry_count) if self.retry_count else 0
            }
        }
    
    def identify_bottleneck(self) -> Optional[str]:
        """Identify slowest stage on average."""
        stage_means = {
            "ingestion": statistics.mean(self.ingestion_ms) if self.ingestion_ms else 0,
            "planning": statistics.mean(self.planning_ms) if self.planning_ms else 0,
            "context_building": statistics.mean(self.context_building_ms) if self.context_building_ms else 0,
            "generation": statistics.mean(self.generation_ms) if self.generation_ms else 0,
            "verification": statistics.mean(self.verification_ms) if self.verification_ms else 0
        }
        
        if not any(stage_means.values()):
            return None
        
        return max(stage_means, key=stage_means.get)


class StageTimer:
    """
    Context manager for timing pipeline stages.
    
    Automatically records to metrics and logs.
    """
    
    def __init__(
        self,
        metrics: PipelineMetrics,
        stage_name: str,
        logger: Optional[Any] = None
    ):
        self.metrics = metrics
        self.stage_name = stage_name
        self.logger = logger
        self.start_time: Optional[float] = None
        self.duration: Optional[float] = None
    
    def __enter__(self) -> StageTimer:
        self.start_time = time.perf_counter()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if self.start_time is None:
            return
        
        self.duration = (time.perf_counter() - self.start_time) * 1000
        
        # Log
        if self.logger:
            self.logger.info(
                f"stage_complete",
                stage=self.stage_name,
                duration_ms=self.duration,
                success=exc_type is None
            )
        
        # Would record to metrics (needs integration with PipelineMetrics)
    
    def get_duration(self) -> Optional[float]:
        """Get measured duration in milliseconds."""
        return self.duration
```

#### 6.4.3 Cost Attribution per Specification and Task

```python
# core/observability.py (continued) - Cost Tracking

from dataclasses import dataclass
from decimal import Decimal


@dataclass
class CostRecord:
    """Single cost record for attribution."""
    timestamp: float
    specification_id: str
    task_id: Optional[str]
    agent_model: str
    prompt_tokens: int
    completion_tokens: int
    cost_usd: Decimal
    
    # Context for analysis
    operation_type: str  # "planning", "generation", "verification", etc.
    success: bool


class CostTracker:
    """
    Track and attribute costs to specifications and tasks.
    
    Enables budget management and optimization identification.
    """
    
    # Model pricing (per 1K tokens) - would be configurable
    PRICING = {
        "gpt-4-turbo": (Decimal("0.01"), Decimal("0.03")),   # input, output
        "gpt-4": (Decimal("0.03"), Decimal("0.06")),
        "gpt-3.5-turbo": (Decimal("0.0005"), Decimal("0.0015")),
        "claude-3-opus": (Decimal("0.015"), Decimal("0.075")),
        "claude-3-sonnet": (Decimal("0.003"), Decimal("0.015")),
        "claude-3-haiku": (Decimal("0.00025"), Decimal("0.00125")),
    }
    
    def __init__(self, storage_path: Optional[Path] = None):
        self.records: list[CostRecord] = []
        self.storage_path = storage_path
    
    def compute_cost(
        self,
        model: str,
        prompt_tokens: int,
        completion_tokens: int
    ) -> Decimal:
        """Compute cost for token usage."""
        input_price, output_price = self.PRICING.get(
            model,
            (Decimal("0.01"), Decimal("0.03"))  # Default to GPT-4 Turbo pricing
        )
        
        input_cost = Decimal(prompt_tokens) * input_price / 1000
        output_cost = Decimal(completion_tokens) * output_price / 1000
        
        return input_cost + output_cost
    
    def record(
        self,
        specification_id: str,
        task_id: Optional[str],
        agent_model: str,
        prompt_tokens: int,
        completion_tokens: int,
        operation_type: str,
        success: bool
    ) -> CostRecord:
        """Record cost for operation."""
        cost = self.compute_cost(agent_model, prompt_tokens, completion_tokens)
        
        record = CostRecord(
            timestamp=time.time(),
            specification_id=specification_id,
            task_id=task_id,
            agent_model=agent_model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            cost_usd=cost,
            operation_type=operation_type,
            success=success
        )
        
        self.records.append(record)
        
        # Persist if configured
        if self.storage_path:
            self._append_record(record)
        
        return record
    
    def get_specification_cost(self, spec_id: str) -> dict[str, Any]:
        """Get total cost breakdown for specification."""
        spec_records = [r for r in self.records if r.specification_id == spec_id]
        
        if not spec_records:
            return {"total": Decimal("0"), "records": 0}
        
        by_task: dict[str, list[CostRecord]] = {}
        by_operation: dict[str, list[CostRecord]] = {}
        
        for r in spec_records:
            by_task.setdefault(r.task_id or "no-task", []).append(r)
            by_operation.setdefault(r.operation_type, []).append(r)
        
        return {
            "total": sum(r.cost_usd for r in spec_records),
            "records": len(spec_records),
            "by_task": {
                task: {
                    "total": sum(r.cost_usd for r in task_records),
                    "tokens": sum(r.prompt_tokens + r.completion_tokens for r in task_records)
                }
                for task, task_records in by_task.items()
            },
            "by_operation": {
                op: {
                    "total": sum(r.cost_usd for r in op_records),
                    "count": len(op_records)
                }
                for op, op_records in by_operation.items()
            },
            "success_rate": sum(1 for r in spec_records if r.success) / len(spec_records)
        }
    
    def get_daily_summary(self, days: int = 7) -> list[dict[str, Any]]:
        """Get cost summary by day."""
        from datetime import datetime, timedelta
        
        cutoff = time.time() - days * 86400
        recent = [r for r in self.records if r.timestamp >= cutoff]
        
        by_day: dict[str, list[CostRecord]] = {}
        for r in recent:
            day = datetime.fromtimestamp(r.timestamp).strftime("%Y-%m-%d")
            by_day.setdefault(day, []).append(r)
        
        return [
            {
                "date": day,
                "total_cost": sum(r.cost_usd for r in day_records),
                "total_tokens": sum(r.prompt_tokens + r.completion_tokens for r in day_records),
                "specifications": len(set(r.specification_id for r in day_records))
            }
            for day, day_records in sorted(by_day.items())
        ]
    
    def identify_optimization_opportunities(self) -> list[dict[str, Any]]:
        """Identify potential cost optimizations."""
        opportunities = []
        
        # Find expensive failed operations (waste)
        failed_expensive = [
            r for r in self.records
            if not r.success and r.cost_usd > Decimal("0.10")
        ]
        
        if failed_expensive:
            opportunities.append({
                "type": "failed_operations",
                "description": f"{len(failed_expensive)} failed operations costing ${sum(r.cost_usd for r in failed_expensive):.2f}",
                "potential_savings": sum(r.cost_usd for r in failed_expensive) * Decimal("0.5"),  # Assume 50% could be saved
                "recommendation": "Improve verification before generation to catch errors early"
            })
        
        # Find over-specified contexts (large prompts)
        large_prompts = [
            r for r in self.records
            if r.prompt_tokens > 10000
        ]
        
        if large_prompts:
            avg_prompt = sum(r.prompt_tokens for r in large_prompts) / len(large_prompts)
            opportunities.append({
                "type": "large_contexts",
                "description": f"{len(large_prompts)} operations with >10K prompt tokens (avg {avg_prompt:.0f})",
                "potential_savings": sum(r.cost_usd for r in large_prompts) * Decimal("0.2"),
                "recommendation": "Implement more aggressive context pruning"
            })
        
        # Find model downgrading opportunities
        expensive_models = ["gpt-4", "claude-3-opus"]
        for record in self.records:
            if record.agent_model in expensive_models and record.success:
                # Check if cheaper model could have worked
                cheaper = "gpt-3.5-turbo" if "gpt" in record.agent_model else "claude-3-haiku"
                cheaper_price = self.PRICING.get(cheaper, (Decimal("0"), Decimal("0")))
                current_price = self.PRICING.get(record.agent_model, (Decimal("0"), Decimal("0")))
                
                savings = (
                    Decimal(record.prompt_tokens) * (current_price[0] - cheaper_price[0]) +
                    Decimal(record.completion_tokens) * (current_price[1] - cheaper_price[1])
                ) / 1000
                
                # Would need success rate data to make recommendation
        
        return opportunities
    
    def _append_record(self, record: CostRecord) -> None:
        """Append record to persistent storage."""
        # Would implement line-delimited JSON or similar
        pass
```

## 7. Integration and Deployment

### 7.1 IDE Integration Pathways

#### 7.1.1 VS Code Extension Architecture (Future)

The VS Code extension represents a **future phase** of OpenKode development, enabling seamless integration with the world's most popular code editor. The extension architecture would leverage:

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Extension Host | TypeScript/Node.js | VS Code API integration |
| Language Server | Python LSP | Cross-editor protocol support |
| WebView Panels | React/Vue | Rich UI for specification editing |
| Native Modules | Rust/Node-API | Performance-critical operations |

The extension would provide: **inline specification decorations** showing AI-generated code provenance; **specification tree view** in Explorer sidebar; **command palette integration** for all OpenKode operations; and **diagnostic integration** for verification results as VS Code problems.

#### 7.1.2 Language Server Protocol (LSP) Compatibility

LSP compatibility enables **editor-agnostic integration**. The OpenKode language server would implement:

| LSP Feature | OpenKode Mapping |
|-------------|----------------|
| `textDocument/definition` | Navigate from generated code to specification |
| `textDocument/references` | Find all code generated from specification |
| `textDocument/codeAction` | "Accept AI suggestion", "Regenerate from spec" |
| `textDocument/codeLens` | Show specification status above functions |
| `workspace/executeCommand` | Trigger OpenKode operations |
| `textDocument/diagnostic` | Verification results as diagnostics |

#### 7.1.3 Neovim/Emacs Plugin Specifications

For **Vim/Neovim users**, a Lua-based plugin would provide: telescope.nvim integration for specification search; nvim-tree integration for specification hierarchy; and LSP client configuration for language server features.

For **Emacs users**, a package would provide: `openkode-mode` for specification editing; `ivy`/`helm` integration for specification search; and `flycheck`/`flymake` integration for verification results.

### 7.2 CI/CD Pipeline Integration

#### 7.2.1 GitHub Actions Custom Runner

```yaml
# .github/workflows/openkode.yml
name: OpenKode Specification Validation

on:
  pull_request:
    paths:
      - '**.spec.yaml'
      - '.openkode/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup OpenKode
        uses: openkode/setup-action@v1
        with:
          version: '0.1.0'
          
      - name: Validate Specifications
        run: openkode spec validate --all --format json > validation.json
        
      - name: Check for Drift
        run: openkode spec check-drift --fail-on-drift
        
      - name: Generate Implementation Report
        if: failure()
        run: openkode spec report --format markdown >> $GITHUB_STEP_SUMMARY
```

#### 7.2.2 Pre-Commit Hook for Specification Validation

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: openkode-validate
        name: OpenKode Specification Validation
        entry: openkode spec validate --staged
        language: system
        files: \.spec\.yaml$
        pass_filenames: false
        
      - id: openkode-sync-check
        name: Check Spec-Code Synchronization
        entry: openkode spec check-sync
        language: system
        always_run: true
        pass_filenames: false
```

#### 7.2.3 Automated PR Generation from Specifications

OpenKode can **automatically generate pull requests** from approved specifications:

```bash
# Generate implementation and create PR
openkode spec execute SPEC-123 --auto-pr \
  --branch-prefix "openkode/" \
  --pr-title "Implement: [SPEC-123] User authentication enhancement" \
  --reviewers "alice,bob"
```

### 7.3 Configuration Management

#### 7.3.1 Project-Level `.openkode.yaml` Schema

```yaml
# .openkode.yaml - Project configuration
version: "1.0"

# Specification settings
specifications:
  directory: "specs"
  template_directory: ".openkode/templates"
  default_agent: "claude-3-sonnet"
  
  # Required in all specifications
  required_fields:
    - acceptance_criteria
    - test_strategy
  
  # Custom validation rules
  validation:
    max_tasks_per_spec: 20
    require_estimated_effort: true

# Agent configuration
agents:
  default: "claude-3-sonnet"
  
  overrides:
    # Use Opus for complex architectural tasks
    - match:
        task_types: ["planning", "refactoring"]
        estimated_effort: "XL"
      agent: "claude-3-opus"
    
    # Use Haiku for quick tasks
    - match:
        estimated_effort: "XS"
      agent: "claude-3-haiku"

# Code generation settings
generation:
  style:
    python:
      formatter: "black"
      max_line_length: 88
      type_hints: "required"
    
    typescript:
      formatter: "prettier"
      strict_mode: true
  
  # Post-processing
  auto_format: true
  auto_lint: true
  require_tests: true

# Verification settings
verification:
  required_verifiers:
    - syntax
    - style
    - security
  
  thresholds:
    min_test_coverage: 80
    max_complexity: 10
  
  custom_verifiers:
    - path: ".openkode/verifiers"

# Caching
cache:
  semantic_cache: true
  ast_cache: true
  distributed:
    enabled: false
    # redis_url: "redis://localhost:6379"

# Observability
observability:
  tracing: true
  metrics: true
  cost_tracking: true
  
  # Export to external systems
  opentelemetry:
    endpoint: "http://localhost:4317"
    insecure: true
```

#### 7.3.2 User-Level Global Configuration

```yaml
# ~/.config/openkode/config.yaml
version: "1.0"

# API keys (can also use environment variables or keychain)
api_keys:
  openai: "${OPENAI_API_KEY}"
  anthropic: "${ANTHROPIC_API_KEY}"

# Default preferences
defaults:
  output_format: "tty"  # or "json", "plain"
  editor: "vim"  # for interactive editing
  
  # UI preferences
  ui:
    theme: "dark"
    animations: true
    keybinding_scheme: "vim"

# Performance tuning
performance:
  max_concurrent_agents: 5
  token_budget_per_minute: 100000
  
  # Local model settings
  local_models:
    enabled: true
    default: "codellama:13b"
    ollama_host: "http://localhost:11434"

# Privacy
privacy:
  share_telemetry: false  # Anonymous usage statistics
  allow_cloud_processing: true  # Can disable for air-gapped
```

#### 7.3.3 Environment-Specific Overrides

Configuration supports **layered overrides**: global defaults → project settings → environment variables → command-line flags.

| Layer | Mechanism | Use Case |
|-------|-----------|----------|
| Built-in defaults | Code | Sensible fallbacks |
| Global config | `~/.config/openkode/config.yaml` | User preferences |
| Project config | `.openkode.yaml` | Team conventions |
| Environment | `OPENKODE_*` variables | CI/CD secrets |
| CLI flags | `--option value` | One-off overrides |

## 8. Quality Assurance and Testing

### 8.1 Unit Testing Strategy

#### 8.1.1 Mock Agent for Deterministic Tests

```python
# tests/conftest.py - Test Fixtures

import pytest
from unittest.mock import AsyncMock, MagicMock

from core.ai_agent import BaseAgent, GenerationResult, TokenUsage


class MockAgent(BaseAgent):
    """
    Deterministic mock agent for testing.
    
    Returns predefined responses based on prompt patterns.
    """
    
    def __init__(self, responses: Optional[dict[str, str]] = None):
        super().__init__(model="mock")
        self.responses = responses or {}
        self.call_history: list[dict[str, Any]] = []
    
    @property
    def capabilities(self) -> set[AgentCapability]:
        return {
            AgentCapability.CHAT_COMPLETION,
            AgentCapability.STRUCTURED_OUTPUT,
        }
    
    async def _generate_impl(self, **kwargs) -> GenerationResult:
        """Return mock response based on prompt."""
        prompt = kwargs.get("prompt", "")
        self.call_history.append(kwargs)
        
        # Find matching response
        for pattern, response in self.responses.items():
            if pattern in prompt:
                return GenerationResult(
                    text=response,
                    usage=TokenUsage(
                        prompt_tokens=len(prompt) // 4,
                        completion_tokens=len(response) // 4,
                        total_tokens=(len(prompt) + len(response)) // 4
                    ),
                    finish_reason="stop"
                )
        
        # Default response
        return GenerationResult(
            text='{"status": "success"}',
            usage=TokenUsage(100, 50, 150),
            finish_reason="stop"
        )


@pytest.fixture
def mock_agent():
    """Provide configured mock agent."""
    return MockAgent({
        "planning": '{"tasks": [{"id": "T1", "title": "Implement feature"}]}',
        "generate python": '```python\ndef hello():\n    return "world"\n```',
    })


@pytest.fixture
def temp_spec_manager(tmp_path):
    """Provide temporary spec manager."""
    from core.spec import SpecManager
    return SpecManager(storage_path=tmp_path / "specs")
```

#### 8.1.2 Property-Based Testing for Specification Parsing

```python
# tests/test_spec_parsing.py - Property Tests

from hypothesis import given, strategies as st
from pydantic import ValidationError

from core.spec import Specification, Task, AcceptanceCriterion


class TestSpecificationParsing:
    """Property-based tests for specification robustness."""
    
    @given(
        title=st.text(min_size=3, max_size=200),
        description=st.text(min_size=10, max_size=1000),
        intent=st.text(min_size=5, max_size=500)
    )
    def test_valid_specification_creation(self, title, description, intent):
        """Any valid strings should create parseable specification."""
        spec = Specification(
            title=title,
            description=description,
            natural_language_intent=intent
        )
        
        assert spec.title == title
        assert spec.status.name == "DRAFT"
        assert len(spec.id) == 36  # UUID
    
    @given(
        title=st.text(max_size=2)  # Too short
    )
    def test_invalid_title_rejected(self, title):
        """Invalid titles should raise validation error."""
        with pytest.raises(ValidationError):
            Specification(
                title=title,
                description="Valid description here",
                natural_language_intent="Valid intent"
            )
    
    @given(
        tasks=st.lists(
            st.fixed_dictionaries({
                "title": st.text(min_size=3, max_size=100),
                "description": st.text(min_size=5, max_size=500)
            }),
            min_size=0,
            max_size=50
        )
    )
    def test_task_list_handling(self, tasks):
        """Various task list sizes should be handled."""
        spec = Specification(
            title="Test Spec",
            description="Test description",
            natural_language_intent="Test intent",
            tasks=[Task(**t) for t in tasks]
        )
        
        assert len(spec.tasks) == len(tasks)
```

### 8.2 Integration Testing

#### 8.2.1 End-to-End Specification-to-Code Workflows

```python
# tests/test_e2e.py - End-to-End Tests

import pytest
import tempfile
from pathlib import Path


@pytest.mark.asyncio
@pytest.mark.slow
class TestEndToEndWorkflow:
    """Full workflow tests with real or sandboxed agents."""
    
    async def test_simple_function_generation(self, mock_agent, tmp_path):
        """Complete flow from spec to working code."""
        from core.spec import SpecManager
        from core.code_generator import CodeGenerator, GenerationContext
        
        # Setup
        spec_manager = SpecManager(tmp_path / "specs")
        
        # Create specification
        spec = spec_manager.create(
            title="Greeting function",
            description="Create a function that returns personalized greetings",
            natural_language_intent='Create greet(name) function returning "Hello, {name}!"'
        )
        
        # Add acceptance criterion
        spec = spec_manager.update(
            spec.id,
            acceptance_criteria=[{
                "description": "greet('World') returns 'Hello, World!'",
                "verification_method": "test"
            }]
        )
        
        # Generate
        ctx = GenerationContext(
            specification=spec,
            current_task=spec.tasks[0] if spec.tasks else Task(
                title="Implement greeting function",
                description="Create the greet function"
            ),
            codebase_root=tmp_path
        )
        
        generator = CodeGenerator(
            agent=mock_agent,
            codebase_context=lambda: ""
        )
        
        result_ctx = await generator.generate(ctx, stages=[GenerationStage.IMPLEMENTATION])
        
        # Verify
        assert result_ctx.implementation is not None
        assert "def greet" in str(result_ctx.implementation)
        
        # Write and validate syntax
        for path, content in result_ctx.implementation.items():
            full_path = tmp_path / path
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(content)
            
            # Validate Python syntax
            import ast
            ast.parse(content)  # Raises SyntaxError if invalid
```

#### 8.2.2 Multi-Agent Conflict Resolution Scenarios

```python
# tests/test_multi_agent.py - Multi-Agent Tests

@pytest.mark.asyncio
class TestMultiAgentCoordination:
    """Tests for agent orchestration and conflict handling."""
    
    async def test_agent_fallback_on_failure(self):
        """Verify fallback when primary agent fails."""
        from core.ai_agent_parallel import AgentPool
        
        # Create failing primary, working backup
        failing_agent = MockAgent({})
        failing_agent._generate_impl = AsyncMock(
            side_effect=Exception("API Error")
        )
        
        backup_agent = MockAgent({
            "test": "backup response"
        })
        
        pool = AgentPool({
            "primary": failing_agent,
            "backup": backup_agent
        })
        
        # Should succeed with fallback
        # (Implementation would need fallback logic)
    
    async def test_parallel_task_execution(self):
        """Verify tasks execute in parallel when possible."""
        import asyncio
        
        execution_order = []
        
        class SlowMockAgent(MockAgent):
            async def _generate_impl(self, **kwargs):
                execution_order.append(kwargs.get("prompt", "")[:10])
                await asyncio.sleep(0.1)  # Simulate work
                return await super()._generate_impl(**kwargs)
        
        agent = SlowMockAgent({"task": "result"})
        pool = AgentPool({"default": agent}, max_concurrent=3)
        
        # Submit multiple independent tasks
        futures = []
        for i in range(5):
            fut = await pool.submit(
                f"task-{i}",
                lambda i=i: agent.generate(prompt=f"task {i}"),
                priority=TaskPriority.NORMAL
            )
            futures.append(fut)
        
        # All should complete
        results = await asyncio.gather(*[asyncio.wrap_future(f) for f in futures])
        assert len(results) == 5
        
        # Should have executed in parallel (order non-deterministic)
        # Total time ~0.2s (2 batches of 3 and 2) not 0.5s (sequential)
```

### 8.3 Performance Benchmarking

#### 8.3.1 Latency Benchmarks by Codebase Size

| Codebase Size | Files | Lines of Code | Ingestion | Planning | Generation | Total |
|-------------|-------|-------------|-----------|----------|-----------|-------|
| Small | <100 | <10K | <1s | <5s | <10s | <20s |
| Medium | 100-1K | 10K-100K | <5s | <15s | <30s | <60s |
| Large | 1K-10K | 100K-1M | <30s | <60s | <120s | <5min |
| Enterprise | >10K | >1M | <2min | <5min | <10min | <20min |

#### 8.3.2 Token Efficiency Metrics

| Optimization | Baseline Tokens | Optimized Tokens | Savings |
|-----------|---------------|----------------|---------|
| No context pruning | 50,000 | — | — |
| + Relevance scoring | 50,000 | 25,000 | 50% |
| + Hierarchical summarization | 25,000 | 15,000 | 40% |
| + Semantic caching | 15,000 | 8,000 | 47% |
| **Combined** | **50,000** | **8,000** | **84%** |

#### 8.3.3 Cost-per-Specification Analysis

| Specification Complexity | Typical Tokens | Cost (Claude 3 Sonnet) | Cost (GPT-4 Turbo) |
|------------------------|--------------|----------------------|-------------------|
| Simple (XS): Utility function | 5K | $0.015 | $0.10 |
| Small (S): API endpoint | 15K | $0.045 | $0.30 |
| Medium (M): Feature with tests | 50K | $0.15 | $1.00 |
| Large (L): Multi-file refactor | 150K | $0.45 | $3.00 |
| Extra Large (XL): Architecture change | 500K | $1.50 | $10.00 |

## 9. Security and Compliance

### 9.1 Code Execution Sandboxing

#### 9.1.1 Container-Based Isolation

| Isolation Level | Technology | Startup | Use Case |
|--------------|-----------|---------|----------|
| Process | Python venv | 100ms | Trusted code, quick tests |
| Container | Docker/Podman | 500ms | General verification |
| VM | Firecracker | 150ms | Untrusted code, security-critical |
| Hardware | KVM | 2s | Maximum isolation |

#### 9.1.2 Resource Limits and Timeout Enforcement

```python
# Sandbox configuration
SANDBOX_LIMITS = {
    "cpu_quota": 1.0,        # 1 CPU core
    "memory_limit": "512m",  # 512 MB RAM
    "pids_limit": 100,       # Max processes
    "timeout_seconds": 60,   # Max execution time
    "network": "none",       # No network access
    "read_only_root": True,  # Immutable filesystem
}
```

### 9.2 API Key and Secret Management

#### 9.2.1 OS Keychain Integration

```python
# core/secrets.py - Secret Management

import keyring  # cross-platform keychain access


class SecureCredentialStore:
    """Store and retrieve credentials from OS keychain."""
    
    SERVICE_NAME = "openkode"
    
    @classmethod
    def store(cls, account: str, credential: str) -> bool:
        """Store credential in keychain."""
        try:
            keyring.set_password(cls.SERVICE_NAME, account, credential)
            return True
        except Exception:
            # Fallback to file with permissions
            return cls._store_fallback(account, credential)
    
    @classmethod
    def retrieve(cls, account: str) -> Optional[str]:
        """Retrieve credential from keychain."""
        try:
            return keyring.get_password(cls.SERVICE_NAME, account)
        except Exception:
            return cls._retrieve_fallback(account)
    
    @classmethod
    def delete(cls, account: str) -> bool:
        """Remove credential from keychain."""
        try:
            keyring.delete_password(cls.SERVICE_NAME, account)
            return True
        except Exception:
            return cls._delete_fallback(account)
```

#### 9.2.2 Short-Lived Credential Rotation

| Credential Type | Lifetime | Rotation Trigger |
|--------------|---------|---------------|
| API keys | 90 days | Calendar, or on suspected compromise |
| Session tokens | 24 hours | Expiration, or explicit logout |
| Temporary credentials | 1 hour | Single operation completion |

### 9.3 Audit and Compliance

#### 9.3.1 Complete Action Logging

All operations logged with: timestamp, user identity, action type, parameters (sanitized), result status, and affected resources.

#### 9.3.2 GDPR/CCPA Data Handling

| Data Category | Retention | Deletion |
|------------|----------|---------|
| Specifications | Until user deletion | Immediate on request |
| Generated code | Same as specifications | Cascading with specifications |
| Usage metrics | 90 days anonymized | N/A (aggregated) |
| API logs | 30 days | Automatic expiration |

## 10. Roadmap and Future Extensions

### 10.1 Phase 1: Core CLI (Current)

**Deliverables**: Specification management, basic agent integration, verification framework, Python implementation.

**Timeline**: Months 1-3.

### 10.2 Phase 2: Rich TUI with Syntax Highlighting

**Deliverables**: `textual`-based interface, real-time streaming, interactive diff review, progress visualization.

**Timeline**: Months 4-6.

### 10.3 Phase 3: IDE Extensions and LSP

**Deliverables**: VS Code extension, language server protocol implementation, Neovim/Emacs plugins.

**Timeline**: Months 7-12.

### 10.4 Phase 4: Collaborative Multi-User Specifications

**Deliverables**: Real-time collaborative editing, specification review workflows, team analytics, enterprise features.

**Timeline**: Year 2+.

---

*This blueprint represents the complete technical specification for OpenKode, a specification-driven development platform bringing Traycer's methodology to terminal-native developer workflows. Implementation prioritizes Python for ecosystem maturity, with architectural boundaries enabling future extension to additional languages and deployment models.*

