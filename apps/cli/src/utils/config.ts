import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { CodersEyeConfig } from "@repo/types";

const CONFIG_DIR = join(homedir(), ".coders-eye");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getDataDir(): string {
  return join(CONFIG_DIR, "data");
}

function validateConfig(raw: unknown): CodersEyeConfig | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.github_token !== "string" || !obj.github_token) return null;
  if (typeof obj.org !== "string" || !obj.org) return null;
  if (typeof obj.claude_path !== "string" || !obj.claude_path) return null;
  if (typeof obj.data_dir !== "string" || !obj.data_dir) return null;
  return {
    github_token: obj.github_token,
    org: obj.org,
    claude_path: obj.claude_path,
    data_dir: obj.data_dir,
  };
}

export function loadConfig(): CodersEyeConfig | null {
  if (!existsSync(CONFIG_FILE)) return null;

  try {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return validateConfig(parsed);
  } catch {
    return null;
  }
}

export function saveConfig(config: CodersEyeConfig): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function configExists(): boolean {
  return existsSync(CONFIG_FILE);
}

export function ensureDataDir(): string {
  const dataDir = getDataDir();
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}
