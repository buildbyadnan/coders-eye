import * as readline from "node:readline";
import { loadConfig, saveConfig, getDataDir } from "../utils/config.js";
import { success, error, info, warn } from "../utils/logger.js";
import { ClaudeRunner } from "@repo/claude";
import { GitHubClient } from "@repo/github";

export async function initCommand(): Promise<void> {
  const existing = loadConfig();
  if (existing) {
    warn("Config already exists at ~/.coders-eye/config.json");
    info("Current config:");
    info(`  GitHub token: ${existing.github_token ? "****" + existing.github_token.slice(-4) : "not set"}`);
    info(`  Organization: ${existing.org || "not set"}`);
    info(`  Claude path:  ${existing.claude_path || "claude"}`);
    info(`  Data dir:     ${existing.data_dir}`);
    info("\nTo reconfigure, delete ~/.coders-eye/config.json and run again.");
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, resolve));

  try {
    console.log("🔧 CodersEye Setup\n");

    // GitHub Token
    const token = await question("GitHub Personal Access Token: ");
    if (!token.trim()) {
      error("GitHub token is required");
      process.exit(1);
    }

    // Verify token
    info("Verifying GitHub token...");
    const github = new GitHubClient(token.trim());
    try {
      await github.getOrgRepos("github"); // Quick test
      success("GitHub token verified");
    } catch {
      warn("Could not verify token (it may still work for private repos)");
    }

    // Organization
    const org = await question("GitHub Organization name: ");
    if (!org.trim()) {
      error("Organization name is required");
      process.exit(1);
    }

    // Claude Code path
    const claudePath = await question("Claude Code path [claude]: ");
    const claude = new ClaudeRunner({ claudePath: claudePath.trim() || "claude" });
    const claudeAvailable = await claude.isAvailable();
    if (claudeAvailable) {
      success("Claude Code found");
    } else {
      warn("Claude Code not found at specified path. Make sure it's installed.");
    }

    const config = {
      github_token: token.trim(),
      org: org.trim(),
      claude_path: claudePath.trim() || "claude",
      data_dir: getDataDir(),
      cache_ttl_hours: 24,
    };

    saveConfig(config);
    success("Config saved to ~/.coders-eye/config.json");
    info(`Data directory: ${config.data_dir}`);
    console.log("\nNext steps:");
    info("  1. Run `coders-eye index` to clone and index your org's repos");
    info("  2. Run `coders-eye review <pr-url>` to review a pull request");
  } finally {
    rl.close();
  }
}
