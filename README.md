<div align="center">

# CodersEye

### Cross-Repository AI Code Review for GitHub PRs

**Powered by Claude Code — Your AI reviewer that sees the whole picture.**

[![npm version](https://img.shields.io/npm/v/coders-eye?color=blue&logo=npm)](https://www.npmjs.com/package/coders-eye)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![CI](https://github.com/buildbyadnan/coders-eye/actions/workflows/ci.yml/badge.svg)](https://github.com/buildbyadnan/coders-eye/actions)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)

</div>

---

## The Problem

A PR in one repository may look correct on its own but still break things elsewhere — violating API contracts, duplicating existing logic, conflicting with another service, or breaking shared type definitions. Single-repo reviews miss these entirely.

## The Solution

CodersEye clones and indexes all repositories in your GitHub organization, then uses Claude Code to review PRs with full awareness of your entire codebase. It catches breaking changes, duplicated logic, and cross-repo inconsistencies that no single-repo tool can see.

---

## Demo

```
$ coders-eye review https://github.com/rooting-at-cloud/api-server/pull/1

════════════════════════════════════════════════════════════
  CodersEye AI Review
  rooting-at-cloud/api-server#1
════════════════════════════════════════════════════════════

  CRITICAL Overall Assessment: CRITICAL

  This PR attempts a partial email-to-emailAddress migration but is
  incomplete and introduces several bugs: the migration helper is dead
  code that doesn't actually migrate anything, findByEmailAddress is a
  non-functional alias that searches the wrong conceptual field, and
  the deprecation warnings are injected into the API response contract
  breaking consumers.

────────────────────────────────────────────────────────────
  Comments (6)

  ERROR src/handlers/users.ts:7 — bug
    migrateUserToEmailV2 is declared but never called anywhere in the
    codebase. It's dead code.
    Suggestion: Either actually migrate the User type or remove this
    dead helper entirely.

  ERROR src/handlers/users.ts:115 — bug
    findByEmailAddress searches u.email — the old field name. If the
    goal is to migrate to emailAddress, this function should search
    u.emailAddress.
    Suggestion: Update the User interface first, then search the new
    field.

  ERROR src/handlers/users.ts:103 — breaking-change
    The message field in createUser response is changed from "User
    created" to "User created (email field deprecated...". Any consumer
    that matches on this string will break.
    Suggestion: Use HTTP headers for deprecation warnings, not the
    response body.

  WARNING src/handlers/users.ts:60 — style
    Using console.log with [MIGRATION] / [DEPRECATION] tags in a
    production API server is inappropriate.
    Suggestion: Use a structured logger with appropriate log levels.

  WARNING src/handlers/users.ts:111 — performance
    findByEmail logs deprecation only when a user IS found. More
    importantly, findByEmailAddress is an exact duplicate of findByEmail.
    Suggestion: Have findByEmail delegate to findByEmailAddress.

  WARNING src/handlers/users.ts:41 — architecture
    The PR adds a migration helper but doesn't actually change the User
    type in shared-types. This creates a half-migrated state.
    Suggestion: Coordinate the migration properly across repos.

════════════════════════════════════════════════════════════
  Duration: 33.0s
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Cross-repo awareness** | Understands code patterns across your entire GitHub organization |
| **Claude Code powered** | Uses your Claude Code subscription — no API key needed |
| **Local-first** | Your code stays on your machine. Nothing sent to external servers |
| **SQLite index** | Fast symbol extraction and lookup with zero configuration |
| **Structured output** | JSON-formatted reviews with file, line, severity, and suggestions |
| **GitHub posting** | Post reviews directly as PR comments with `--post` |
| **Multi-language** | TypeScript, JavaScript, Python, Go, Ruby, Rust, Java |
| **CLI + Bot** | Use as a CLI tool today, webhook listener tomorrow |

---

## Quick Start

### Prerequisites

- **Node.js >= 22**
- **Git**
- **Claude Code CLI** ([install](https://docs.anthropic.com/en/docs/claude-code))
- **GitHub Personal Access Token** ([generate](https://github.com/settings/tokens))

### Install

```bash
npm install -g coders-eye
```

### Setup

```bash
# Interactive setup — enter your GitHub token, org name, and Claude path
coders-eye init
```

### Index Your Organization

```bash
# Clone and index all repos in your org
coders-eye index

# Check what was indexed
coders-eye status
```

### Review a Pull Request

```bash
# Review any PR in your org
coders-eye review https://github.com/yourorg/yourrepo/pull/42

# Post the review as a GitHub PR comment
coders-eye review https://github.com/yourorg/yourrepo/pull/42 --post
```

---

## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `coders-eye init` | First-time setup | `coders-eye init` |
| `coders-eye index` | Index all org repos | `coders-eye index --force` |
| `coders-eye review <url>` | Review a PR | `coders-eye review https://github.com/org/repo/pull/1` |
| `coders-eye search <query>` | Search indexed code | `coders-eye search "handleAuth"` |
| `coders-eye update` | Pull latest and re-index | `coders-eye update` |
| `coders-eye status` | Show config and stats | `coders-eye status` |

---

## How It Works

```
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │   1. INDEX   │     │  2. ANALYZE  │     │  3. CONTEXT  │     │   4. REVIEW  │
  │              │     │              │     │              │     │              │
  │ Clone repos  │────▶│ Extract      │────▶│ Match cross- │────▶│ Claude Code  │
  │ Parse code   │     │ symbols,     │     │ repo code    │     │ analyzes PR  │
  │ Store in DB  │     │ imports,     │     │ to PR diff   │     │ with full    │
  │              │     │ types        │     │              │     │ org context  │
  └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### 1. Index

CodersEye clones all non-fork repositories in your GitHub organization and parses every source file. It extracts functions, classes, interfaces, types, constants, and import dependencies into a local SQLite database.

### 2. Analyze

When you review a PR, CodersEye fetches the diff and identifies all identifiers, imports, and type references that were added or modified.

### 3. Context

It searches the SQLite index for matching symbols across all other repositories in your org. It finds related functions, shared types, import chains, and API contracts — building a rich cross-repository context window.

### 4. Review

The PR diff and cross-repo context are sent to Claude Code as a structured prompt. Claude analyzes the code with full awareness of your organization's patterns and produces a structured JSON review.

---

## Architecture

```
coders-eye/
├── packages/
│   ├── types/          Shared TypeScript interfaces
│   ├── http/           Fetch utilities, HMAC, timeouts
│   ├── github/         GitHub API client (PRs, diffs, repos)
│   ├── indexer/         Repo cloning + symbol extraction + SQLite
│   ├── context/         Cross-repo context builder
│   ├── claude/          Claude Code CLI runner + prompt + parser
│   ├── review/          Review orchestration pipeline
│   └── api-endpoints/   Hono.js route definitions
├── apps/
│   ├── cli/            CLI tool (npm package)
│   ├── server/         Hono.js webhook handler (Cloudflare Workers)
│   └── web/            Next.js dashboard (coming soon)
├── Architecture.md     Detailed architecture + decisions
├── LIMITATIONS.md      Known limitations + future work
└── AI_USAGE.md         How AI tools were used in development
```

See [Architecture.md](Architecture.md) for detailed system design and engineering decisions.

---

## Configuration

Config is stored at `~/.coders-eye/config.json`:

```json
{
  "github_token": "ghp_...",
  "org": "your-org",
  "claude_path": "claude",
  "data_dir": "~/.coders-eye/data"
}
```

| Field | Description | Default |
|-------|-------------|---------|
| `github_token` | GitHub Personal Access Token | Required |
| `org` | GitHub organization name | Required |
| `claude_path` | Path to Claude Code CLI binary | `claude` |
| `data_dir` | Directory for SQLite database and cloned repos | `~/.coders-eye/data` |

---

## Development

```bash
# Clone the repo
git clone https://github.com/buildbyadnan/coders-eye.git
cd coders-eye

# Install dependencies
npm install

# Build all packages
npx nx run-many -t build

# Typecheck all packages
npx nx run-many -t typecheck

# Run the CLI in development
npx coders-eye help
```

### Project Structure

This is an **NX monorepo** with shared packages and multiple apps. Internal packages (`@repo/*`) are resolved via workspace protocol and bundled into the CLI with tsup.

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture.md](Architecture.md) | System design, data flow, database schema, engineering decisions |
| [LIMITATIONS.md](LIMITATIONS.md) | Known limitations and what would be built next |
| [AI_USAGE.md](AI_USAGE.md) | How AI tools were used during development |
| [SETUP.md](SETUP.md) | Step-by-step setup guide with troubleshooting |

---

## License

[MIT](LICENSE) — Copyright 2026 AdnanBuilds

---

<div align="center">

**Built as a 24-hour take-home assignment by [Adnan](https://github.com/buildbyadnan)**

*Demonstrating cross-repository AI code review with Claude Code integration*

</div>
