# How AI Tools Were Used During Development

This document explains how AI tools were used to build CodersEye within the 24-hour assignment window.

---

## AI Tools Used

| Tool | Purpose |
|------|---------|
| **Opencode** | Primary and sole development assistant — architecture design, full code generation, debugging, documentation |

---

## What Was AI-Generated vs Human-Written

### AI-Generated (with human review and modification)

- **Package scaffolding** — NX workspace setup, tsconfig files, package.json structure
- **All source code** — Every package, every command, every utility function
- **Regex patterns** — Symbol extraction patterns for TypeScript/JavaScript/Python
- **SQLite schema** — Table definitions and query patterns
- **GitHub API client** — REST API calls, pagination, error handling
- **Prompt construction** — The structured review prompt sent to Claude Code
- **JSON parser** — Brace-counting JSON extraction from Claude's response
- **Context builder** — Cross-repo matching algorithms and relevance scoring
- **CLI commands** — Command structure, argument parsing, output formatting
- **CI/CD pipeline** — GitHub Actions workflow with typecheck, build, and npm publish
- **Documentation** — README, Architecture.md, SETUP.md, LIMITATIONS.md

### Human-Decided

- **Project scope** — What to include in V1 and what to defer
- **Trade-off decisions** — SQLite over D1, regex over AST, CLI over API
- **Architecture direction** — High-level approach and priorities
- **Assignment requirements** — Understanding and interpreting the brief
- **Demo strategy** — What to show in the Loom video

---

## How Opencode Was Used Throughout the Build

### Architecture Design

I described the assignment requirements to Opencode and asked it to help decompose the problem into manageable packages. Opencode suggested the package structure based on separation of concerns:

```
types → http → github → indexer → context → claude → review
```

This dependency chain ensures each package has a single responsibility and can be tested independently.

### Trade-off Analysis

For each major decision, I presented the options to Opencode and asked for a comparison:

| Decision | Options Considered | AI Recommendation | My Decision |
|----------|-------------------|-------------------|-------------|
| Database | SQLite vs D1 vs Postgres | SQLite for V1 (zero config) | Agreed |
| Parser | Regex vs tree-sitter vs babel | Regex for V1 (simpler) | Agreed |
| Claude integration | CLI vs API | CLI (assignment requirement) | Required |
| Package manager | npm vs pnpm vs yarn | npm (widest compatibility) | Agreed |
| Bundler | esbuild vs tsup vs rollup | tsup (simple config) | Agreed |

### Full Implementation

Opencode generated the complete codebase — all 35+ source files across 8 packages and 3 applications. This included:
- Type definitions, HTTP utilities, GitHub client
- Indexer with symbol extraction and SQLite storage
- Context builder with three-layer matching strategy
- Claude Code integration with prompt engineering and output parsing
- Review orchestration pipeline
- CLI commands (init, index, review, search, update, status)
- Server scaffolding for future webhook bot
- Web dashboard skeleton

I reviewed every file for correctness, security, and performance before committing.

### Debugging

Opencode diagnosed and fixed all CI/CD issues during the build:

**Issue 1: npm Lock File Incompatibility**
- `npm ci` failed because the lock file was generated with npm 11 (Node 24) but CI also ran Node 22 (npm 10)
- Opencode identified the incompatibility and recommended standardizing on Node 24

**Issue 2: npm Provenance requires repository.url**
- `npm publish --provenance` failed with "repository.url is empty"
- Opencode identified the missing field and added the correct metadata

**Issue 3: JSON Extraction from Claude Output**
- Claude's response sometimes included explanatory text before/after the JSON
- Opencode implemented brace-counting JSON extraction to handle this

### Documentation

Opencode wrote all documentation — README.md, Architecture.md, LIMITATIONS.md, AI_USAGE.md, and SETUP.md. I reviewed and approved each document.

---

## Lessons Learned

1. **AI is excellent for end-to-end implementation** — Opencode handled everything from architecture to deployment
2. **Human judgment still matters for scope** — Deciding what to include in V1 required human decisions
3. **AI excels at debugging** — Rapid diagnosis of CI failures and runtime errors saved hours
4. **AI-generated code needs review** — Security, performance, and edge cases require human attention
5. **AI speeds up iteration** — What would take days was completed in under 24 hours

---

## Time Breakdown

| Activity | Time | AI Assistance |
|----------|------|---------------|
| Architecture design | 2 hours | 70% |
| Package implementation | 8 hours | 85% |
| CLI commands | 3 hours | 80% |
| CI/CD pipeline | 2 hours | 90% |
| Debugging | 2 hours | 95% |
| Documentation | 3 hours | 70% |
| Testing & polish | 2 hours | 60% |

**Total:** ~22 hours (within the 24-hour limit)
