#!/usr/bin/env node

import { initCommand } from "./commands/init.js";
import { indexCommand } from "./commands/index.js";
import { reviewCommand } from "./commands/review.js";
import { searchCommand } from "./commands/search.js";
import { statusCommand } from "./commands/status.js";
import { updateCommand } from "./commands/update.js";
import { error, info } from "./utils/logger.js";

const VERSION = "0.1.0";

function printHelp(): void {
  console.log(`
  CodersEye v${VERSION} — Cross-repository AI code review for GitHub PRs

  USAGE:
    coders-eye <command> [options]

  COMMANDS:
    init                          First-time setup (GitHub token, org, Claude path)
    index [--org <name>] [--force] Clone and index all repos in your org
    review <pr-url> [--post]      Review a pull request
    search <query>                Search indexed code
    update                        Pull latest changes and re-index
    status                        Show current configuration and stats
    serve [--port <port>]         Start webhook listener (coming soon)
    help                          Show this help message

  OPTIONS:
    --version                     Show version number
    --post                        Post review as GitHub PR comment
    --json                        Output raw JSON instead of formatted text
    --force                       Force re-index all repos
    --org <name>                  Override organization from config

  EXAMPLES:
    coders-eye init
    coders-eye index
    coders-eye review https://github.com/myorg/myrepo/pull/42
    coders-eye review https://github.com/myorg/myrepo/pull/42 --post
    coders-eye search "handleAuth"
    coders-eye status

  CONFIG:
    Config is stored at ~/.coders-eye/config.json
    Indexed data is stored at ~/.coders-eye/data/
  `);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "--version" || command === "-v") {
    console.log(VERSION);
    return;
  }

  switch (command) {
    case "init":
      await initCommand();
      break;

    case "index": {
      const orgIdx = args.indexOf("--org");
      const org = orgIdx !== -1 && orgIdx + 1 < args.length && !args[orgIdx + 1].startsWith("--")
        ? args[orgIdx + 1]
        : undefined;
      const force = args.includes("--force");
      await indexCommand({ org, force });
      break;
    }

    case "review": {
      const url = args[1];
      if (!url) {
        error("PR URL is required. Usage: coders-eye review <pr-url>");
        process.exit(1);
      }
      const post = args.includes("--post");
      const json = args.includes("--json");
      await reviewCommand({ url, post, json });
      break;
    }

    case "search": {
      const query = args.slice(1).join(" ");
      if (!query) {
        error("Search query is required. Usage: coders-eye search <query>");
        process.exit(1);
      }
      await searchCommand({ query });
      break;
    }

    case "update":
      await updateCommand();
      break;

    case "status":
      await statusCommand();
      break;

    case "serve":
      info("Webhook server coming soon! For now, use `coders-eye review` manually.");
      break;

    default:
      error(`Unknown command: ${command}`);
      info("Run `coders-eye help` for available commands.");
      process.exit(1);
  }
}

main().catch((err) => {
  const stack = err instanceof Error ? err.stack : String(err);
  error(`Fatal error: ${stack}`);
  process.exit(1);
});
