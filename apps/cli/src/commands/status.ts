import { loadConfig } from "../utils/config.js";
import { success, error, info, warn, highlight, dim } from "../utils/logger.js";
import { getStats } from "@repo/indexer";

export async function statusCommand(): Promise<void> {
  const config = loadConfig();
  if (!config) {
    error("Not configured. Run `coders-eye init` first.");
    process.exit(1);
  }

  console.log("\n" + highlight("CodersEye Status") + "\n");

  info("Configuration:");
  console.log(`  GitHub token: ${config.github_token ? "****" + config.github_token.slice(-4) : "not set"}`);
  console.log(`  Organization: ${config.org}`);
  console.log(`  Claude path:  ${config.claude_path}`);
  console.log(`  Data dir:     ${config.data_dir}`);

  try {
    const stats = getStats(config.data_dir);

    console.log("\nIndex Stats:");
    info(`  Repos:     ${stats.repos_indexed}`);
    info(`  Files:     ${stats.files_indexed}`);
    info(`  Symbols:   ${stats.symbols_indexed}`);
    if (stats.last_indexed_at) {
      info(`  Last run:  ${stats.last_indexed_at}`);
    } else {
      warn("  No repos indexed yet. Run `coders-eye index` first.");
    }
  } catch {
    warn("  Could not read index stats. Run `coders-eye index` first.");
  }

  console.log("");
}
