# Architecture

## Overview

CodersEye is a cross-repository code review tool that uses Claude Code to analyze GitHub PRs with context from other repositories in the same organization. It's built as an NX monorepo with 8 internal packages and 3 applications.

---

## System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI (coders-eye)                        │
│   init │ index │ review │ search │ update │ status │ serve      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│               @repo/review — Review Orchestrator                │
│                                                                 │
│  1. Parse PR URL                                                │
│  2. Fetch PR diff via GitHub API                                │
│  3. Build cross-repo context from SQLite index                  │
│  4. Construct structured prompt with diff + context             │
│  5. Execute Claude Code CLI headlessly                          │
│  6. Parse JSON output into ReviewResult                         │
│  7. Optionally post review as GitHub PR comment                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  @repo/github   │ │  @repo/context  │ │  @repo/claude   │
│                 │ │                 │ │                 │
│  PR metadata    │ │  Symbol matching│ │  CLI execution  │
│  Diff fetching  │ │  Import graph   │ │  Prompt builder │
│  Comment posting│ │  Relevance calc │ │  Output parser  │
│  Org repo list  │ │  Deduplication  │ │                 │
└────────┬────────┘ └────────┬────────┘ └─────────────────┘
         │                   │
         ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│               @repo/indexer — Storage Engine                    │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  repos   │  │  files   │  │ symbols  │  │ imports  │       │
│  │          │  │          │  │          │  │          │       │
│  │ org repos│  │ per-repo │  │ functions│  │ import/  │       │
│  │ metadata │  │ metadata │  │ classes  │  │ require  │       │
│  │          │  │          │  │ types    │  │ graphs   │       │
│  │          │  │          │  │ enums    │  │          │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                 │
│  SQLite (better-sqlite3) — WAL mode, foreign keys, indexed     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Package Breakdown

### `@repo/types` — Shared Type Definitions

Zero-dependency package containing all TypeScript interfaces used across the system. This ensures type safety across packages without circular dependencies.

**Key types:** `GitHubPR`, `GitHubFile`, `GitHubRepo`, `Symbol`, `FileMetadata`, `ImportInfo`, `CrossRepoMatch`, `ReviewResult`, `ReviewComment`, `ReviewOutput`, `IndexStats`, `CodersEyeConfig`

### `@repo/http` — HTTP Utilities

Low-level fetch utilities shared by all packages that make network requests. Provides:
- `fetchWithTimeout()` — fetch with configurable timeout and abort controller
- `hmacHex()` — HMAC-SHA256 for webhook signature verification
- `constantTimeCompare()` — timing-safe string comparison

### `@repo/github` — GitHub API Client

A lightweight GitHub REST API client built on `@repo/http`. No Octokit dependency — keeps the bundle small.

**Responsibilities:**
- PR metadata, files, and diff fetching (with pagination)
- Organization repository listing (paginated)
- PR comment posting (for the `--post` flag)
- Webhook signature verification
- PR URL parsing

### `@repo/indexer` — Code Indexing Engine

The core indexing engine with three main components:

**`SymbolParser`** — Walks directory trees and extracts symbols from source files using regex-based parsing. Supports TypeScript, JavaScript, Python, Ruby, Go, Rust, and Java. Extracts functions, classes, interfaces, types, enums, constants, and their doc comments.

**`IndexStore`** — SQLite storage layer using `better-sqlite3`. Handles upserts, cascading deletes, and indexed queries. Uses WAL mode for concurrent read performance.

**`RepoCloner`** — Git clone and pull operations for fetching repository code.

### `@repo/context` — Cross-Repository Context Builder

The intelligence layer that connects PR changes to related code across the organization.

**Matching strategy (3 layers):**
1. **Identifier matching** — Extracts identifiers from added lines and finds matching symbols in other repos
2. **File-name matching** — Uses file base names to find related files across repos
3. **Import graph matching** — Traces import chains to find consumers of changed code

**Scoring:** Each match gets a relevance score (0.0–1.0) based on exact name match, substring match, and character similarity. Results are deduplicated and capped at 500 matches.

### `@repo/claude` — Claude Code Integration

Three components:

**`ClaudeRunner`** — Executes the Claude Code CLI headlessly via `child_process.execFile`. Uses `--print` and `--dangerously-skip-permissions` flags for non-interactive execution. Configurable timeout (default 3 minutes) and buffer size.

**`buildReviewPrompt()`** — Constructs a structured prompt with:
- PR diff
- Cross-repository context
- File count and repo details
- Output format specification (JSON schema)
- Review criteria (bugs, security, performance, breaking changes, etc.)

Includes prompt size management — truncates to 100KB limit with intelligent budget allocation (70% diff, 30% context).

**`parseClaudeOutput()`** — Extracts JSON from Claude's response using brace-counting (handles nested objects in strings). Validates and sanitizes the parsed result.

### `@repo/review` — Review Pipeline

The orchestrator that ties everything together. Single `reviewPR()` function executes the full pipeline:
1. Parse PR URL → extract owner/repo/number
2. Check Claude Code availability
3. Fetch PR metadata, files, and diff
4. Build cross-repository context
5. Construct prompt and run Claude Code
6. Parse and format output
7. Optionally post to GitHub

### `@repo/api-endpoints` — Route Definitions

Hono.js route definitions shared between the server app and any future HTTP interface.

---

## Data Flow

### Indexing Flow

```
coders-eye index
  │
  ├── GitHubClient.getOrgRepos(org)
  │     └── GET /orgs/{org}/repos (paginated)
  │
  ├── For each repo:
  │     ├── RepoCloner.clone(cloneUrl, targetDir)
  │     │     └── git clone --depth 1
  │     │
  │     ├── IndexStore.upsertRepo(repoData)
  │     │     └── INSERT OR UPDATE repos table
  │     │
  │     ├── SymbolParser.parseAll()
  │     │     ├── walkDir() → find all source files
  │     │     ├── extractSymbols() → regex-based parsing
  │     │     ├── extractImports() → import/require parsing
  │     │     └── Returns { files, symbols, imports }
  │     │
  │     ├── IndexStore.upsertFiles(repoId, files)
  │     │     └── INSERT OR REPLACE files table
  │     │
  │     ├── IndexStore.insertSymbols(fileId, symbols)
  │     │     └── INSERT symbols table
  │     │
  │     └── IndexStore.insertImports(fileId, imports)
  │           └── INSERT imports table
  │
  └── Done → SQLite database at ~/.coders-eye/data/db/coders-eye.db
```

### Review Flow

```
coders-eye review https://github.com/org/repo/pull/42
  │
  ├── GitHubClient.parsePRUrl(url)
  │     └── Returns { owner: "org", repo: "repo", prNumber: 42 }
  │
  ├── ClaudeRunner.isAvailable()
  │     └── claude --version (5s timeout)
  │
  ├── GitHubClient.getPR(owner, repo, prNumber)
  │     └── GET /repos/{owner}/{repo}/pulls/{prNumber}
  │
  ├── GitHubClient.getPRFiles(owner, repo, prNumber)
  │     └── GET /repos/{owner}/{repo}/pulls/{prNumber}/files
  │
  ├── GitHubClient.getPRDiff(owner, repo, prNumber)
  │     └── GET /repos/{owner}/{repo}/pulls/{prNumber} (Accept: application/vnd.github.v3.diff)
  │
  ├── ContextBuilder.buildPRContext(prContext, diff)
  │     ├── findRelatedCode(filename, patch) → identifier matching
  │     ├── findRelatedBySymbols(files) → file-name matching
  │     ├── findRelatedByImports(files) → import graph matching
  │     ├── deduplicateMatches() → remove duplicates
  │     └── Returns { prDiff, crossRepoMatches, summary }
  │
  ├── ContextBuilder.buildContextPrompt(builtContext)
  │     └── Formats cross-repo matches as readable text
  │
  ├── buildReviewPrompt(diff, context, prNumber, repo, fileCount)
  │     └── Structured prompt with JSON output schema
  │
  ├── ClaudeRunner.run(prompt)
  │     └── claude --print --dangerously-skip-permissions -p "{prompt}"
  │
  ├── parseClaudeOutput(rawOutput)
  │     ├── extractJson() → brace-counting JSON extraction
  │     ├── JSON.parse()
  │     └── Returns ReviewResult { summary, severity, comments[] }
  │
  └── Output formatted review to terminal (or post to GitHub)
```

---

## Database Schema

### `repos` — Indexed Repositories

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment ID |
| `github_id` | INTEGER UNIQUE | GitHub repository ID |
| `name` | TEXT | Repository name |
| `full_name` | TEXT | `owner/repo` format |
| `default_branch` | TEXT | Default branch (usually `main`) |
| `language` | TEXT | Primary language |
| `description` | TEXT | Repository description |
| `is_private` | INTEGER | Whether repo is private |
| `clone_url` | TEXT | HTTPS clone URL |
| `last_indexed_at` | TEXT | Last indexing timestamp |

### `files` — File Metadata

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment ID |
| `repo_id` | INTEGER FK | References `repos.id` |
| `path` | TEXT | Relative file path |
| `language` | TEXT | File language |
| `size` | INTEGER | File size in bytes |
| `content_hash` | TEXT | Simple content hash for change detection |

### `symbols` — Code Symbols

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment ID |
| `file_id` | INTEGER FK | References `files.id` |
| `name` | TEXT | Symbol name |
| `kind` | TEXT | `function`, `class`, `interface`, `type`, `enum`, `const` |
| `signature` | TEXT | First line / signature of the symbol |
| `start_line` | INTEGER | Starting line number |
| `end_line` | INTEGER | Ending line number |
| `doc_comment` | TEXT | JSDoc/docstring if present |
| `is_exported` | INTEGER | Whether symbol is exported |

### `imports` — Import Dependencies

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment ID |
| `file_id` | INTEGER FK | References `files.id` |
| `source` | TEXT | `npm`, `relative`, `org-package` |
| `target` | TEXT | Import target string |
| `import_path` | TEXT | Full import path |
| `is_type_only` | INTEGER | Whether it's a type-only import |

### `reviews` — Review History

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PK | Auto-increment ID |
| `pr_number` | INTEGER | Pull request number |
| `repo_full_name` | TEXT | Repository full name |
| `status` | TEXT | `pending`, `running`, `completed`, `failed` |
| `summary` | TEXT | Review summary |
| `review_json` | TEXT | Full JSON review result |
| `claude_raw_output` | TEXT | Raw Claude Code output |
| `duration_ms` | INTEGER | Review duration in milliseconds |

---

## Key Engineering Decisions

### 1. NX Monorepo

**Decision:** Use NX with npm workspaces for the project structure.

**Why:** The system has 8 internal packages with clear dependency boundaries. NX provides:
- Type-safe cross-package imports via TypeScript project references
- Incremental builds (only rebuild changed packages)
- Single `nx run-many` command for typecheck/build across all packages
- Clean dependency graph enforcement

**Trade-off:** Adds NX as a dev dependency and requires `npx nx` for builds. For a V1, this is acceptable because the monorepo structure will scale cleanly as packages grow.

### 2. SQLite Over Cloudflare D1

**Decision:** Use `better-sqlite3` locally instead of Cloudflare D1.

**Why:** The assignment requires a working V1. SQLite:
- Zero configuration — works immediately after `npm install`
- No cloud account needed — keeps the setup simple
- Fast — WAL mode handles concurrent reads efficiently
- Portable — single `.db` file at `~/.coders-eye/data/db/coders-eye.db`

**Trade-off:** No cloud sync or multi-device access. For a local CLI tool, this is acceptable. The cloud tier (D1) is designed for the future webhook bot use case.

### 3. Claude Code CLI Over Direct API

**Decision:** Execute Claude Code as a subprocess instead of calling the Anthropic API directly.

**Why:** The assignment explicitly requires this: "The primary code-review reasoning should run through Claude Code Subscription instead of any API." Benefits:
- No API key management — uses existing Claude Code authentication
- Leverages Claude Code's built-in context window management
- No cost tracking needed — uses existing subscription
- Future-proof — Claude Code handles model upgrades automatically

**Trade-off:** Requires Claude Code CLI to be installed. Slower than direct API calls (CLI startup overhead). The 3-minute timeout handles most reviews but very large diffs may need adjustment.

### 4. Local-First Architecture

**Decision:** All code processing happens on the user's machine.

**Why:** The assignment says "Handle private repository code and credentials responsibly." Local-first means:
- Repository code never leaves the machine during V1
- GitHub tokens stay in `~/.coders-eye/config.json` — not sent to any server
- The only external call is to Claude Code CLI (which is also local)
- Users maintain full control over their code

**Trade-off:** No shared team index. Each developer indexes independently. This is acceptable for V1 and can be solved with a shared database in V2.

### 5. Regex-Based Symbol Extraction Over Full AST

**Decision:** Use regex patterns to extract symbols instead of a full AST parser.

**Why:** A full AST parser (like `@babel/parser` or `typescript` compiler API) would be more accurate but:
- Much heavier dependency tree
- Requires language-specific parsers for each supported language
- Significantly slower for large codebases
- Regex covers 90% of common patterns (functions, classes, interfaces, types)

**Trade-off:** Misses some edge cases (nested functions, complex type expressions, decorators). For a code review tool, the accuracy is sufficient — the goal is to find related code, not to build a perfect AST.

### 6. Prompt Engineering for Structured Output

**Decision:** Request JSON output from Claude Code with a specific schema.

**Why:** Structured output enables:
- Consistent formatting across all reviews
- Machine-readable results (for future GitHub Actions integration)
- Severity-based filtering and sorting
- Line-number-precise comments

**Implementation:** The prompt includes a JSON schema with `summary`, `severity`, and `comments[]` fields. The parser uses brace-counting to extract JSON from Claude's response (handles nested objects in strings). The 100KB prompt limit ensures the context window isn't exceeded.

### 7. Three-Layer Context Matching

**Decision:** Use three complementary matching strategies instead of one.

**Why:** No single strategy catches all relevant code:
- **Identifier matching** — Catches when the same function/type name appears across repos
- **File-name matching** — Catches related files (e.g., `users.ts` in api-server and web-app)
- **Import graph matching** — Catches consumer relationships (who imports what you changed)

**Scoring:** Each match gets a relevance score. The top 500 matches (deduplicated) are sent to Claude, ensuring the most relevant context without overwhelming the prompt.

---

## Dependency Graph

```
@repo/types (zero deps)
    │
    ├── @repo/http
    │       │
    │       └── @repo/github
    │               │
    │               ├── @repo/indexer
    │               │       │
    │               │       └── @repo/context
    │               │               │
    │               └── @repo/claude ─┤
    │                               │
    │                       @repo/review
    │                               │
    │                       ┌───────┴───────┐
    │                       │               │
    │                   apps/cli        apps/server
```

All internal packages are bundled into the CLI via tsup, resulting in a single 66KB ESM file with only `better-sqlite3` as an external dependency.
