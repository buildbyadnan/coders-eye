# Architecture

## Overview

CodersEye is a cross-repository code review tool that uses Claude Code to analyze GitHub PRs with context from other repositories in the same organization.

## System Design

```
┌─────────────────────────────────────────────────────────┐
│                    CLI (coders-eye)                     │
├─────────────────────────────────────────────────────────┤
│  init │ index │ review │ search │ status │ update      │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  @repo/review (Orchestrator)            │
├─────────────────────────────────────────────────────────┤
│  1. Fetch PR diff (GitHub API)                          │
│  2. Build cross-repo context (SQLite + symbol search)  │
│  3. Run Claude Code CLI with context prompt             │
│  4. Parse and format review output                      │
└─────────────────────────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  @repo/github   │ │  @repo/context  │ │  @repo/claude   │
│  GitHub API     │ │  Context Builder│ │  CLI Runner     │
└─────────────────┘ └─────────────────┘ └─────────────────┘
          │                 │
          ▼                 ▼
┌─────────────────────────────────────────────────────────┐
│                  @repo/indexer (Storage)                │
├─────────────────────────────────────────────────────────┤
│  SQLite DB with repos, files, symbols, imports tables   │
└─────────────────────────────────────────────────────────┘
```

## Packages

### @repo/github
GitHub API client using Octokit patterns. Handles:
- PR metadata and diff fetching
- Org repo listing
- Webhook signature verification
- PR comment posting

### @repo/indexer
Repo indexing engine. Handles:
- Git clone and pull operations
- Symbol extraction (TypeScript, JavaScript, Python)
- Import/dependency graph building
- SQLite persistence

### @repo/context
Cross-repo context builder. Handles:
- Matching PR changes to related code in other repos
- Building context windows for Claude
- Relevance scoring
- Deduplication

### @repo/claude
Claude Code CLI integration. Handles:
- Running `claude` CLI headlessly
- Prompt construction
- Output parsing
- Error handling

### @repo/review
Review orchestration pipeline. Handles:
- Coordinating all packages
- Building the review pipeline
- Formatting output for GitHub/CLI

## Data Flow

### Indexing Flow
```
coders-eye index
  → GitHubClient.getOrgRepos()
  → RepoCloner.clone() for each repo
  → SymbolParser.parseAll() on each repo
  → IndexStore.upsertFiles/insertSymbols/insertImports()
```

### Review Flow
```
coders-eye review <pr-url>
  → GitHubClient.getPR() + getPRFiles() + getPRDiff()
  → ContextBuilder.buildPRContext()
    → IndexStore.findSimilarSymbols() for each changed identifier
    → IndexStore.findImportsByTarget() for import analysis
  → ClaudeRunner.run(buildReviewPrompt())
  → parseClaudeOutput() → ReviewResult
```

## Database Schema

| Table | Purpose |
|-------|---------|
| `repos` | Indexed repositories |
| `files` | File metadata per repo |
| `symbols` | Code symbols (functions, types, etc.) |
| `imports` | Import/dependency graph |
| `reviews` | Review history |

## Key Decisions

1. **SQLite over D1 for V1** — Free, fast, no server needed. Cloud tier uses D1.
2. **Symbol extraction over full AST** — Simpler, faster, covers 90% of use cases.
3. **Claude Code CLI over API** — Per assignment requirement. No API key needed.
4. **Local-first architecture** — Code never leaves the user's machine during V1.
5. **NX monorepo** — Shared packages, type safety, single build pipeline.
