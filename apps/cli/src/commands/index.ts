import { loadConfig, ensureDataDir } from "../utils/config.js";
import { success, error, info, warn } from "../utils/logger.js";
import { indexOrg, getStats } from "@repo/indexer";

export async function indexCommand(options: { force?: boolean; org?: string }): Promise<void> {
  const config = loadConfig();
  if (!config) {
    error("Not configured. Run `coders-eye init` first.");
    process.exit(1);
  }

  const dataDir = ensureDataDir();
  const org = options.org || config.org;

  info(`Indexing repos for org: ${org}`);
  if (options.force) warn("Force mode: re-indexing all repos");

  try {
    const result = await indexOrg({
      org,
      token: config.github_token,
      dataDir,
      force: options.force,
    });

    console.log("\n" + "─".repeat(50));
    success("Indexing complete!");
    info(`  Repos indexed:    ${result.reposIndexed}`);
    info(`  Files indexed:    ${result.filesIndexed}`);
    info(`  Symbols indexed:  ${result.symbolsIndexed}`);

    if (result.errors.length > 0) {
      warn(`  Errors: ${result.errors.length}`);
      for (const err of result.errors) {
        warn(`    - ${err}`);
      }
    }

    const stats = getStats(dataDir);
    console.log("\nTotal index stats:");
    info(`  Total repos:    ${stats.repos_indexed}`);
    info(`  Total files:    ${stats.files_indexed}`);
    info(`  Total symbols:  ${stats.symbols_indexed}`);
    if (stats.last_indexed_at) {
      info(`  Last indexed:   ${stats.last_indexed_at}`);
    }
  } catch (err) {
    error(`Indexing failed: ${err}`);
    process.exit(1);
  }
}
