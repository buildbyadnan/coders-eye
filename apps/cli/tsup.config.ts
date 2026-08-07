import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  outdir: "dist",
  bundle: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  platform: "node",
  banner: {
    js: "#!/usr/bin/env node",
  },
  alias: {
    "@repo/types": "../../packages/types/src/index.ts",
    "@repo/http": "../../packages/http/src/index.ts",
    "@repo/github": "../../packages/github/src/index.ts",
    "@repo/indexer": "../../packages/indexer/src/index.ts",
    "@repo/context": "../../packages/context/src/index.ts",
    "@repo/claude": "../../packages/claude/src/index.ts",
    "@repo/review": "../../packages/review/src/index.ts",
  },
  external: [
    "better-sqlite3",
  ],
});
