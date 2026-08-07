# CodersEye

Cross-repository AI code review for GitHub PRs — powered by Claude Code.

CodersEye reviews your pull requests with context from other repositories in your GitHub organization. It catches breaking changes, duplicated logic, API contract violations, and pattern inconsistencies that a single-repo review would miss.

## Features

- **Cross-repository awareness** — Understands code patterns across your entire org
- **Claude Code powered** — Uses your Claude Code subscription (no API key needed)
- **Local-first** — Your code stays on your machine, nothing sent to external servers
- **Fast** — SQLite-backed index with symbol extraction for instant context lookup
- **CLI + Bot** — Use as a CLI tool or run as a webhook listener

## Quick Start

```bash
# Install
npm install -g coders-eye

# Setup
coders-eye init

# Index your org's repos
coders-eye index

# Review a PR
coders-eye review https://github.com/yourorg/yourrepo/pull/42
```

## Commands

| Command | Description |
|---------|-------------|
| `coders-eye init` | First-time setup (GitHub token, org, Claude path) |
| `coders-eye index` | Clone and index all repos in your org |
| `coders-eye review <url>` | Review a pull request |
| `coders-eye search <query>` | Search indexed code |
| `coders-eye update` | Pull latest changes and re-index |
| `coders-eye status` | Show current configuration and stats |

## How It Works

1. **Index** — CodersEye clones your org's repos and extracts symbols (functions, types, classes, etc.) into a local SQLite database
2. **Analyze** — When you review a PR, it fetches the diff and searches for related code across all indexed repos
3. **Context** — It builds a rich context window with cross-repo references and sends it to Claude Code
4. **Review** — Claude Code analyzes the PR with full awareness of your org's codebase and provides actionable feedback

## Configuration

Config is stored at `~/.coders-eye/config.json`:

```json
{
  "github_token": "ghp_...",
  "org": "your-org",
  "claude_path": "claude",
  "data_dir": "~/.coders-eye/data",
  "cache_ttl_hours": 24
}
```

## Architecture

```
coders-eye/
├── packages/
│   ├── github/      GitHub API client
│   ├── indexer/      Repo cloning + symbol extraction
│   ├── context/      Cross-repo context builder
│   ├── claude/       Claude Code CLI integration
│   └── review/       Review orchestration
├── apps/
│   ├── cli/          The CLI tool (npm package)
│   └── server/       Hono.js webhook handler
```

## Development

```bash
# Clone
git clone https://github.com/coders-eye/coders-eye.git
cd coders-eye

# Install dependencies
npm install

# Build all packages
npx nx run-many -t build

# Typecheck
npx nx run-many -t typecheck
```

## License

MIT
