import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

export interface CloneResult {
  path: string;
  branch: string;
  alreadyExisted: boolean;
}

export class RepoCloner {
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
  }

  private getRepoDir(cloneUrl: string): string {
    const match = cloneUrl.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (!match) throw new Error(`Invalid clone URL: ${cloneUrl}`);
    return join(this.dataDir, "repos", match[1]);
  }

  private injectToken(cloneUrl: string, token: string): string {
    const url = new URL(cloneUrl);
    url.username = "x-access-token";
    url.password = token;
    return url.toString();
  }

  async clone(cloneUrl: string, token: string): Promise<CloneResult> {
    const repoDir = this.getRepoDir(cloneUrl);
    const alreadyExisted = existsSync(repoDir);

    if (alreadyExisted) {
      await this.pull(repoDir);
      const branch = await this.getCurrentBranch(repoDir);
      return { path: repoDir, branch, alreadyExisted: true };
    }

    const authenticatedUrl = this.injectToken(cloneUrl, token);

    mkdirSync(repoDir, { recursive: true });

    try {
      await execFileAsync("git", [
        "clone",
        "--depth=1",
        "--single-branch",
        authenticatedUrl,
        repoDir,
      ], { timeout: 120_000 });
    } catch (error) {
      try { rmSync(repoDir, { recursive: true }); } catch {}
      throw error;
    }

    const branch = await this.getCurrentBranch(repoDir);
    return { path: repoDir, branch, alreadyExisted: false };
  }

  async pull(repoDir: string): Promise<void> {
    await execFileAsync("git", ["pull", "--ff-only"], {
      cwd: repoDir,
      timeout: 60_000,
    });
  }

  async update(repoDir: string): Promise<void> {
    if (!existsSync(repoDir)) return;
    try {
      await this.pull(repoDir);
    } catch {
      console.warn(`Failed to pull ${repoDir}, re-cloning required`);
    }
  }

  private async getCurrentBranch(repoDir: string): Promise<string> {
    const { stdout } = await execFileAsync("git", ["branch", "--show-current"], {
      cwd: repoDir,
    });
    return stdout.trim();
  }
}
