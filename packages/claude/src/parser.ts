import type { ReviewResult, ReviewComment } from "@repo/types";

function extractJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") depth++;
    if (ch === "}") depth--;

    if (depth === 0) {
      return text.substring(start, i + 1);
    }
  }

  return null;
}

export function parseClaudeOutput(rawOutput: string): ReviewResult {
  try {
    const jsonStr = extractJson(rawOutput);
    if (!jsonStr) {
      return {
        summary: "Failed to parse Claude Code output. Raw response saved.",
        severity: "warning",
        comments: [],
      };
    }

    const parsed = JSON.parse(jsonStr);

    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : "No summary provided",
      severity: validateSeverity(parsed.severity),
      comments: Array.isArray(parsed.comments)
        ? parsed.comments.map(validateComment)
        : [],
    };
  } catch (error) {
    return {
      summary: `Failed to parse Claude Code output: ${error}`,
      severity: "warning",
      comments: [],
    };
  }
}

function validateSeverity(severity: unknown): ReviewResult["severity"] {
  if (["critical", "warning", "info"].includes(severity as string)) {
    return severity as ReviewResult["severity"];
  }
  return "info";
}

function validateComment(comment: unknown): ReviewComment {
  const c = comment as Record<string, unknown>;
  const validCategories = [
    "bug", "security", "performance", "style", "architecture", "breaking-change",
  ];
  const category = typeof c.category === "string" && validCategories.includes(c.category)
    ? c.category as ReviewComment["category"]
    : "style";

  return {
    file: typeof c.file === "string" ? c.file : "unknown",
    line: typeof c.line === "number" ? c.line : undefined,
    severity: ["error", "warning", "info", "suggestion"].includes(c.severity as string)
      ? c.severity as ReviewComment["severity"]
      : "info",
    category,
    message: typeof c.message === "string" ? c.message : "No message",
    suggestion: typeof c.suggestion === "string" ? c.suggestion : undefined,
    cross_repo_context:
      typeof c.cross_repo_context === "string"
        ? c.cross_repo_context
        : undefined,
  };
}
