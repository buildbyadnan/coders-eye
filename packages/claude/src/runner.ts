import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ClaudeRunnerOptions {
  claudePath?: string;
  timeout?: number;
  maxBuffer?: number;
}

export class ClaudeRunner {
  private claudePath: string;
  private timeout: number;
  private maxBuffer: number;

  constructor(options: ClaudeRunnerOptions = {}) {
    this.claudePath = options.claudePath || "claude";
    this.timeout = options.timeout || 180_000;
    this.maxBuffer = options.maxBuffer || 10 * 1024 * 1024;
  }

  async run(prompt: string): Promise<string> {
    try {
      const { stdout, stderr } = await execFileAsync(
        this.claudePath,
        [
          "--print",
          "--dangerously-skip-permissions",
          "-p",
          prompt,
        ],
        {
          timeout: this.timeout,
          maxBuffer: this.maxBuffer,
        },
      );

      if (stderr && stderr.trim()) {
        console.error("Claude stderr:", stderr.trim());
      }

      return stdout.trim();
    } catch (error: any) {
      if (error.killed) {
        throw new Error("Claude Code timed out after " + this.timeout + "ms");
      }
      throw new Error(`Claude Code failed: ${error.message}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync(this.claudePath, ["--version"], {
        timeout: 5_000,
      });
      return true;
    } catch {
      return false;
    }
  }

  getPath(): string {
    return this.claudePath;
  }
}
