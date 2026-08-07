# Known Limitations

This document describes the current limitations of CodersEye V1 and what would be built with more time.

---

## Current Limitations

### 1. CLI-Only Interface

**Limitation:** CodersEye currently works only as a CLI tool. There's no web dashboard, no GitHub App, and no automated webhook listener.

**Impact:** Users must manually run commands. There's no automatic review on PR creation, no GitHub status checks, and no team-wide visibility.

### 2. Local-Only Index

**Limitation:** Each developer maintains their own local index. There's no shared team index or cloud-synced database.

**Impact:** Every team member must run `coders-eye index` independently. Index freshness depends on individual update frequency.

### 3. Regex-Based Symbol Extraction

**Limitation:** Symbol extraction uses regex patterns instead of a full AST parser. This covers common patterns (functions, classes, interfaces, types, enums) but misses edge cases like nested functions, complex generic types, decorators, and mixin patterns.

**Impact:** Some symbols may not be indexed, leading to incomplete cross-repo context. The accuracy is sufficient for V1 but not perfect.

### 4. Limited Language Support

**Limitation:** While the parser supports TypeScript, JavaScript, Python, Ruby, Go, Rust, and Java, the depth of extraction varies. TypeScript/JavaScript extraction is the most thorough. Other languages get basic function/class extraction only.

**Impact:** Cross-repo context may be less complete for non-TypeScript projects.

### 5. No Incremental Indexing

**Limitation:** `coders-eye update` re-clones and re-indexes all repos. There's no delta-based indexing that only processes changed files.

**Impact:** Updates are slower than necessary for large organizations with many repos.

### 6. No Caching of Reviews

**Limitation:** Each review is a fresh Claude Code execution. There's no caching of previous reviews or deduplication of identical PR states.

**Impact:** Re-reviewing the same PR (e.g., after a minor push) incurs full Claude Code execution time.

### 7. Single-Threading

**Limitation:** Indexing processes repos sequentially. Review execution is single-threaded.

**Impact:** Large organizations with 50+ repos may experience slow initial indexing (5-10 minutes).

### 8. No Webhook Bot (Yet)

**Limitation:** The `serve` command is scaffolded but not implemented. There's no automatic GitHub webhook listener.

**Impact:** No automated PR reviews on creation. The tool requires manual invocation.

### 9. Prompt Size Limit

**Limitation:** The prompt is capped at 100KB to avoid Claude Code context window issues. For very large diffs with extensive cross-repo context, some information may be truncated.

**Impact:** Reviews of massive PRs (50+ files) may have incomplete context.

### 10. No Review History UI

**Limitation:** Reviews are stored in the SQLite database but there's no web interface to browse historical reviews.

**Impact:** Users can only see the most recent review output in their terminal.

---

## What Would Be Built Next

### Phase 1: Webhook Bot (Week 1-2)

- Implement the `serve` command as a Cloudflare Worker
- Receive GitHub webhooks on PR creation/update
- Automatically trigger reviews and post results as PR comments
- Add GitHub App authentication (instead of personal tokens)
- Implement status checks (pass/fail based on review severity)

### Phase 2: Cloud Index (Week 3-4)

- Migrate from local SQLite to Cloudflare D1
- Shared team index accessible from any device
- Background indexing worker that keeps the index fresh
- Delta-based indexing (only process changed files)
- Multi-org support

### Phase 3: Full AST Parsing (Week 5-6)

- Replace regex parser with tree-sitter for accurate AST extraction
- Support for TypeScript generics, decorators, conditional types
- Full Python AST (type hints, async functions, context managers)
- Import graph with transitive dependency analysis

### Phase 4: Review Intelligence (Week 7-8)

- Review caching and deduplication
- Incremental reviews (only review changed code since last push)
- Learning from past reviews (which comments were accepted/rejected)
- Custom rule engine (org-specific patterns and conventions)
- Review severity thresholds and auto-merge integration

### Phase 5: Web Dashboard (Week 9-10)

- Next.js dashboard for browsing review history
- Team analytics (most common issues, review trends)
- Configuration UI (manage org settings, review rules)
- Integration with GitHub Actions for CI/CD reporting

---

## Technical Debt

| Item | Priority | Effort |
|------|----------|--------|
| Add unit tests for all packages | High | 2-3 days |
| Implement incremental indexing | Medium | 2-3 days |
| Add retry logic for GitHub API calls | Medium | 1 day |
| Add structured logging throughout | Low | 1 day |
| Add webhook signature verification | Medium | 0.5 days |
| Add `--json` output flag | Low | 0.5 days |
