import { loadConfig, ensureDataDir } from "../utils/config.js";
import { success, error, info, highlight, dim, severityColor } from "../utils/logger.js";
import { reviewPR } from "@repo/review";
import type { ReviewOutput, ReviewResult } from "@repo/types";

interface ReviewCommandOptions {
  url: string;
  post?: boolean;
  json?: boolean;
}

export async function reviewCommand(options: ReviewCommandOptions): Promise<void> {
  const config = loadConfig();
  if (!config) {
    error("Not configured. Run `coders-eye init` first.");
    process.exit(1);
  }

  const dataDir = ensureDataDir();

  info(`Reviewing: ${highlight(options.url)}`);

  try {
    const output = await reviewPR({
      prUrl: options.url,
      token: config.github_token,
      dataDir,
      claudePath: config.claude_path,
      postToGitHub: options.post,
    });

    if (options.json) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    printReview(output);
  } catch (err) {
    error(`Review failed: ${err}`);
    process.exit(1);
  }
}

function printReview(output: ReviewOutput): void {
  const result = output.result;
  if (!result) {
    error("No review result");
    return;
  }

  console.log("\n" + "═".repeat(60));
  console.log(`  ${highlight("CodersEye AI Review")}`);
  console.log(`  ${dim(output.repo_full_name)}#${output.pr_number}`);
  console.log("═".repeat(60));

  const severityBadge = getSeverityBadge(result.severity);
  console.log(`\n  ${severityBadge} Overall Assessment: ${result.severity.toUpperCase()}`);
  console.log(`\n  ${result.summary}\n`);

  if (result.comments.length > 0) {
    console.log("─".repeat(60));
    console.log(`  ${highlight(`Comments (${result.comments.length})`)}\n`);

    for (const comment of result.comments) {
      const badge = getSeverityBadge(comment.severity);
      const location = comment.line ? `${comment.file}:${comment.line}` : comment.file;

      console.log(`  ${badge} ${dim(location)} — ${comment.category}`);
      console.log(`    ${comment.message}`);

      if (comment.suggestion) {
        console.log(`    ${dim("Suggestion:")} ${comment.suggestion}`);
      }
      if (comment.cross_repo_context) {
        console.log(`    ${dim("Cross-repo:")} ${comment.cross_repo_context}`);
      }
      console.log("");
    }
  }

  console.log("═".repeat(60));
  console.log(`  Duration: ${(output.duration_ms / 1000).toFixed(1)}s`);
  if (output.post_to_github) {
    success("Review posted to GitHub PR");
  }
  console.log("═".repeat(60) + "\n");
}

function getSeverityBadge(severity: string): string {
  const color = severityColor(severity);
  const reset = "\x1b[0m";
  const badges: Record<string, string> = {
    critical: `${color}🔴 CRITICAL${reset}`,
    error: `${color}🔴 ERROR${reset}`,
    warning: `${color}🟡 WARNING${reset}`,
    info: `${color}🔵 INFO${reset}`,
    suggestion: `${color}💡 SUGGESTION${reset}`,
  };
  return badges[severity] || `${color}${severity.toUpperCase()}${reset}`;
}
