import { loadConfig, ensureDataDir } from "../utils/config.js";
import { success, error, info, dim } from "../utils/logger.js";
import { searchDataDir } from "@repo/indexer";

interface SearchCommandOptions {
  query: string;
}

export async function searchCommand(options: SearchCommandOptions): Promise<void> {
  const config = loadConfig();
  if (!config) {
    error("Not configured. Run `coders-eye init` first.");
    process.exit(1);
  }

  const dataDir = ensureDataDir();

  info(`Searching for: "${options.query}"`);

  try {
    const results = searchDataDir(dataDir, options.query);

    if (results.length === 0) {
      info("No results found");
      return;
    }

    console.log(`\nFound ${results.length} results:\n`);

    for (const r of results) {
      const location = `${r.repo_name}/${r.file_path}:${r.start_line}`;
      console.log(`  ${r.name} (${r.kind})`);
      console.log(`    ${dim(location)}`);
      if (r.signature) {
        console.log(`    ${dim(r.signature)}`);
      }
      console.log("");
    }
  } catch (err) {
    error(`Search failed: ${err}`);
    process.exit(1);
  }
}
