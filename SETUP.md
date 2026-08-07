# Setup Guide

## Prerequisites

- Node.js >= 20
- Git
- Claude Code CLI installed and authenticated
- GitHub Personal Access Token

## 1. Get a GitHub Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `read:org`
4. Copy the token

## 2. Install CodersEye

```bash
npm install -g coders-eye
```

## 3. Initialize

```bash
coders-eye init
```

You'll be prompted for:
- GitHub token
- Organization name
- Claude Code path (default: `claude`)

## 4. Index Repos

```bash
coders-eye index
```

This clones all non-fork repos in your org and extracts symbols.

## 5. Review a PR

```bash
coders-eye review https://github.com/yourorg/yourrepo/pull/42
```

## 6. Post Review to GitHub

```bash
coders-eye review https://github.com/yourorg/yourrepo/pull/42 --post
```

## Troubleshooting

### "Claude Code not found"
Make sure Claude Code is installed and in your PATH. Check with:
```bash
claude --version
```

### "GitHub token is invalid"
Ensure your token has `repo` and `read:org` scopes.

### "No cross-repo context found"
Run `coders-eye index` first to build the symbol index.
