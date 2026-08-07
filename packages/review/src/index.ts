import { GitHubClient } from "@repo/github";
import { ContextBuilder } from "@repo/context";
import { ClaudeRunner, buildReviewPrompt, parseClaudeOutput } from "@repo/claude";
import type { ReviewResult, ReviewOutput } from "@repo/types";

export interface ReviewOptions {
  prUrl: string;
  token: string;
  dataDir: string;
  claudePath?: string;
  postToGitHub?: boolean;
}

export async function reviewPR(options: ReviewOptions): Promise<ReviewOutput> {
  const { prUrl, token, dataDir, claudePath, postToGitHub = false } = options;
  const startTime = Date.now();

  const github = new GitHubClient(token);

  const parsed = github.parsePRUrl(prUrl);
  if (!parsed) {
    throw new Error(`Invalid PR URL: ${prUrl}`);
  }

  const { owner, repo, prNumber } = parsed;
  const repoFullName = `${owner}/${repo}`;

  console.log(`Reviewing PR: ${repoFullName}#${prNumber}`);

  const claude = new ClaudeRunner({ claudePath });
  const isAvailable = await claude.isAvailable();
  if (!isAvailable) {
    throw new Error(
      `Claude Code CLI not found at: ${claude.getPath()}\n` +
      `Install it from: https://docs.anthropic.com/en/docs/claude-code\n` +
      `Or specify path with: coders-eye init --claude-path /path/to/claude`
    );
  }

  const contextBuilder = new ContextBuilder(dataDir);

  try {
    // 1. Fetch PR data
    console.log("Fetching PR metadata...");
    const pr = await github.getPR(owner, repo, prNumber);
    const files = await github.getPRFiles(owner, repo, prNumber);
    const diff = await github.getPRDiff(owner, repo, prNumber);

    console.log(`  Files changed: ${files.length}`);

    // 2. Build cross-repo context
    console.log("Building cross-repository context...");
    const prContext = {
      repoFullName,
      prNumber,
      files,
    };
    const builtContext = contextBuilder.buildPRContext(prContext, diff);
    console.log(`  Cross-repo matches: ${builtContext.crossRepoMatches.length}`);

    // 3. Build prompt and run Claude
    console.log("Running Claude Code review...");
    const crossRepoContextText = contextBuilder.buildContextPrompt(builtContext);
    const prompt = buildReviewPrompt({
      prDiff: diff,
      crossRepoContext: crossRepoContextText,
      prNumber,
      repoFullName,
      fileCount: files.length,
    });

    const rawOutput = await claude.run(prompt);

    // 4. Parse output
    console.log("Parsing review output...");
    const result = parseClaudeOutput(rawOutput);

    const isParseFailure = result.summary.includes("Failed to parse");
    const durationMs = Date.now() - startTime;

    const output: ReviewOutput = {
      pr_number: prNumber,
      repo_full_name: repoFullName,
      status: isParseFailure ? "failed" : "completed",
      result,
      raw_output: rawOutput,
      duration_ms: durationMs,
      created_at: new Date().toISOString(),
    };

    // 5. Post to GitHub if requested
    if (postToGitHub && !isParseFailure) {
      console.log("Posting review to GitHub...");
      const comment = formatGitHubComment(result);
      await github.postPRComment(owner, repo, prNumber, comment);
    }

    console.log(`Review completed in ${(durationMs / 1000).toFixed(1)}s`);
    return output;
  } finally {
    contextBuilder.close();
  }
}

function formatGitHubComment(result: ReviewResult): string {
  const lines: string[] = [];

  lines.push("## 🤖 CodersEye AI Review\n");
  lines.push(`**Overall:** ${result.severity.toUpperCase()}`);
  lines.push(`\n${result.summary}\n`);

  if (result.comments.length > 0) {
    lines.push("---\n");
    lines.push(`### Comments (${result.comments.length})\n`);

    const severityEmoji: Record<string, string> = {
      error: "🔴",
      warning: "🟡",
      info: "🔵",
      suggestion: "💡",
    };

    for (const comment of result.comments) {
      const emoji = severityEmoji[comment.severity] || "⚪";
      const location = comment.line ? `${comment.file}:${comment.line}` : comment.file;
      lines.push(`#### ${emoji} \`${location}\` — ${comment.category}\n`);
      lines.push(`${comment.message}\n`);
      if (comment.suggestion) {
        lines.push(`> 💡 Suggestion: ${comment.suggestion}\n`);
      }
      if (comment.cross_repo_context) {
        lines.push(`> 🔗 Cross-repo context: ${comment.cross_repo_context}\n`);
      }
    }
  }

  lines.push("\n---\n");
  lines.push("*Powered by [CodersEye](https://github.com/coders-eye) — Cross-repository AI code review*");

  return lines.join("\n");
}
