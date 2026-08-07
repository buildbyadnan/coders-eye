# CodersEye

Cross-repository AI code review for GitHub PRs — powered by Claude Code.

CodersEye reviews your pull requests with context from other repositories in your GitHub organization. It catches breaking changes, duplicated logic, API contract violations, and pattern inconsistencies that a single-repo review would miss.

## Features

- **Cross-repository awareness** — Understands code patterns across your entire org
- **Claude Code powered** — Uses your Claude Code subscription (no API key needed)
- **Local-first** — Your code stays on your machine, nothing sent to external servers
- **SQLite index** — Fast symbol extraction and lookup with zero configuration
- **Structured output** — JSON-formatted reviews with file, line, severity, and suggestions
- **Multi-language** — TypeScript, JavaScript, Python, Go, Ruby, Rust, Java

## Quick Start

```bash
# Install
npm install -g coders-eye

# Setup (enter GitHub token, org name, Claude path)
coders-eye init

# Index your org's repos
coders-eye index

# Review a PR
coders-eye review https://github.com/yourorg/yourrepo/pull/42

# Post review as GitHub PR comment
coders-eye review https://github.com/yourorg/yourrepo/pull/42 --post
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
  "data_dir": "~/.coders-eye/data"
}
```

## Prerequisites

- Node.js >= 22
- Git
- Claude Code CLI ([install](https://docs.anthropic.com/en/docs/claude-code))
- GitHub Personal Access Token ([generate](https://github.com/settings/tokens))

## Links

- [GitHub](https://github.com/buildbyadnan/coders-eye)
- [Issues](https://github.com/buildbyadnan/coders-eye/issues)
- [Architecture](https://github.com/buildbyadnan/coders-eye/blob/main/Architecture.md)

## License

[MIT](https://github.com/buildbyadnan/coders-eye/blob/main/LICENSE)
