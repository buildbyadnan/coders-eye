import { loadConfig, ensureDataDir } from "../utils/config.js";
import { success, error, info } from "../utils/logger.js";
import { indexOrg } from "@repo/indexer";

export async function updateCommand(): Promise<void> {
  const config = loadConfig();
  if (!config) {
    error("Not configured. Run `coders-eye init` first.");
    process.exit(1);
  }

  const dataDir = ensureDataDir();

  info("Updating indexed repos...");

  try {
    const result = await indexOrg({
      org: config.org,
      token: config.github_token,
      dataDir,
      force: false,
    });

    success("Update complete!");
    info(`  Repos updated: ${result.reposIndexed}`);
    info(`  Files indexed: ${result.filesIndexed}`);
    info(`  Symbols:       ${result.symbolsIndexed}`);

    if (result.errors.length > 0) {
      info(`  Errors:        ${result.errors.length}`);
    }
  } catch (err) {
    error(`Update failed: ${err}`);
    process.exit(1);
  }
}
