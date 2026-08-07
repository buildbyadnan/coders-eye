import type { DbSymbol } from "@repo/indexer";

const MAX_PROMPT_SIZE = 100_000;

function truncateToLimit(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const half = Math.floor(limit / 2);
  return text.substring(0, half) + "\n\n... [truncated] ...\n\n" + text.substring(text.length - half);
}

export interface PromptOptions {
  prDiff: string;
  crossRepoContext: string;
  prNumber: number;
  repoFullName: string;
  fileCount: number;
}

export function buildReviewPrompt(options: PromptOptions): string {
  let { prDiff, crossRepoContext, prNumber, repoFullName, fileCount } = options;

  const prompt = `You are a senior code reviewer analyzing a GitHub pull request for ${repoFullName}#${prNumber}.

## Your Task
Review the following PR diff and provide actionable feedback. Consider:
1. Bugs and logic errors
2. Security vulnerabilities
3. Performance issues
4. Breaking changes to API contracts
5. Code style and architecture consistency
6. Missing error handling
7. Duplication of existing logic
8. Compatibility with other services in the organization

## Cross-Repository Context
${crossRepoContext || "No cross-repository context available."}

## PR Details
- Repository: ${repoFullName}
- PR: #${prNumber}
- Files changed: ${fileCount}

## PR Diff
${prDiff}

## Output Format
Respond in this exact JSON structure (no other text, just the JSON):
{
  "summary": "One paragraph overall assessment of the PR quality and risks",
  "severity": "critical|warning|info",
  "comments": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "error|warning|info|suggestion",
      "category": "bug|security|performance|style|architecture|breaking-change",
      "message": "What is wrong and why",
      "suggestion": "Optional suggested fix"
    }
  ]
}

Rules:
- Be specific and actionable in your comments
- Reference the exact file and line number
- If no issues found, return an empty comments array with severity "info"
- Focus on real problems, not style preferences
- If you find a breaking change that affects other repos, mark it as "breaking-change"
- Keep the summary concise (2-3 sentences max)`;

  if (prompt.length > MAX_PROMPT_SIZE) {
    const crossRepoBudget = Math.floor(MAX_PROMPT_SIZE * 0.3);
    const diffBudget = MAX_PROMPT_SIZE - crossRepoBudget - 1000;
    crossRepoContext = truncateToLimit(crossRepoContext, crossRepoBudget);
    prDiff = truncateToLimit(prDiff, diffBudget);

    return `You are a senior code reviewer analyzing a GitHub pull request for ${repoFullName}#${prNumber}.

## Your Task
Review the following PR diff and provide actionable feedback. Consider:
1. Bugs and logic errors
2. Security vulnerabilities
3. Performance issues
4. Breaking changes to API contracts
5. Code style and architecture consistency
6. Missing error handling
7. Duplication of existing logic
8. Compatibility with other services in the organization

## Cross-Repository Context
${crossRepoContext || "No cross-repository context available."}

## PR Details
- Repository: ${repoFullName}
- PR: #${prNumber}
- Files changed: ${fileCount}

## PR Diff
${prDiff}

## Output Format
Respond in this exact JSON structure (no other text, just the JSON):
{
  "summary": "One paragraph overall assessment of the PR quality and risks",
  "severity": "critical|warning|info",
  "comments": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "error|warning|info|suggestion",
      "category": "bug|security|performance|style|architecture|breaking-change",
      "message": "What is wrong and why",
      "suggestion": "Optional suggested fix"
    }
  ]
}

Rules:
- Be specific and actionable in your comments
- Reference the exact file and line number
- If no issues found, return an empty comments array with severity "info"
- Focus on real problems, not style preferences
- If you find a breaking change that affects other repos, mark it as "breaking-change"
- Keep the summary concise (2-3 sentences max)`;
  }

  return prompt;
}

export function buildSearchPrompt(query: string, results: (DbSymbol & { repo_name: string; file_path: string })[]): string {
  const resultsText = results
    .map(
      (r) =>
        `- ${r.repo_name}/${r.file_path}:${r.start_line} — ${r.name} (${r.kind})${r.signature ? `\n  ${r.signature}` : ""}`,
    )
    .join("\n");

  return `Search results for "${query}":\n\n${resultsText}`;
}
