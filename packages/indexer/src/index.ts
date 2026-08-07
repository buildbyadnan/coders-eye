import { GitHubClient } from "@repo/github";
import { RepoCloner } from "./clone";
import { SymbolParser } from "./parser";
import { IndexStore } from "./store";

export interface IndexOptions {
  org: string;
  token: string;
  dataDir: string;
  force?: boolean;
}

export interface IndexResult {
  reposIndexed: number;
  filesIndexed: number;
  symbolsIndexed: number;
  errors: string[];
}

export async function indexOrg(options: IndexOptions): Promise<IndexResult> {
  const { org, token, dataDir, force = false } = options;

  const github = new GitHubClient(token);
  const cloner = new RepoCloner(dataDir);
  const store = new IndexStore(dataDir);

  const result: IndexResult = {
    reposIndexed: 0,
    filesIndexed: 0,
    symbolsIndexed: 0,
    errors: [],
  };

  try {
    console.log(`Fetching repos for org: ${org}`);
    const repos = await github.getOrgRepos(org);
    const nonForkRepos = repos.filter((r) => !r.fork);

    console.log(`Found ${nonForkRepos.length} non-fork repos`);

    for (const repo of nonForkRepos) {
      try {
        console.log(`\nIndexing: ${repo.full_name}`);

        const repoId = store.upsertRepo({
          github_id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          default_branch: repo.default_branch,
          language: repo.language,
          description: repo.description,
          is_private: repo.private,
          clone_url: repo.clone_url,
        });

        if (!force) {
          const existing = store.getRepoByFullName(repo.full_name);
          if (existing?.last_indexed_at) {
            console.log(`  Skipping (already indexed)`);
            continue;
          }
        }

        console.log(`  Cloning...`);
        const cloneResult = await cloner.clone(repo.clone_url, token);
        console.log(`  Path: ${cloneResult.path}`);

        console.log(`  Parsing symbols...`);
        const parser = new SymbolParser(cloneResult.path, repoId);
        const { files, fileData } = await parser.parseAll();

        store.clearRepoData(repoId);

        const fileMap = store.upsertFiles(repoId, files);

        let symbolsInserted = 0;
        let importsInserted = 0;

        for (const file of files) {
          const fileId = fileMap.get(file.path);
          if (!fileId) continue;

          const data = fileData.get(file.path);
          if (!data) continue;

          if (data.symbols.length > 0) {
            store.insertSymbols(fileId, data.symbols);
            symbolsInserted += data.symbols.length;
          }

          if (data.imports.length > 0) {
            store.insertImports(fileId, data.imports);
            importsInserted += data.imports.length;
          }
        }

        store.markRepoIndexed(repoId);

        result.reposIndexed++;
        result.filesIndexed += files.length;
        result.symbolsIndexed += symbolsInserted;

        console.log(
          `  Done: ${files.length} files, ${symbolsInserted} symbols, ${importsInserted} imports`,
        );
      } catch (error) {
        const msg = `Error indexing ${repo.full_name}: ${error}`;
        console.error(`  ${msg}`);
        result.errors.push(msg);
      }
    }
  } finally {
    store.close();
  }

  return result;
}

export function searchDataDir(dataDir: string, query: string) {
  const store = new IndexStore(dataDir);
  const results = store.searchSymbols(query);
  store.close();
  return results;
}

export function getStats(dataDir: string) {
  const store = new IndexStore(dataDir);
  const stats = store.getStats();
  store.close();
  return stats;
}

export { IndexStore, type DbSymbol, type DbImport, type DbRepo } from "./store";
export { SymbolParser } from "./parser";
export { RepoCloner } from "./clone";
