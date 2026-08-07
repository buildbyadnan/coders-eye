import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";
import type { Symbol, FileMetadata, ImportInfo } from "@repo/types";

const MAX_FILE_SIZE = 5_000_000; // 5MB

const SUPPORTED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rb", ".go", ".rs", ".java",
]);

const SKIP_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next",
  "__pycache__", ".venv", "vendor", "target",
]);

export interface ParseResult {
  files: FileMetadata[];
  symbols: Symbol[];
  imports: ImportInfo[];
  fileData: Map<string, { file: FileMetadata; symbols: Symbol[]; imports: ImportInfo[] }>;
}

export class SymbolParser {
  private repoDir: string;
  private repoId: number;

  constructor(repoDir: string, repoId: number) {
    this.repoDir = repoDir;
    this.repoId = repoId;
  }

  async parseAll(): Promise<ParseResult> {
    const files: FileMetadata[] = [];
    const symbols: Symbol[] = [];
    const imports: ImportInfo[] = [];
    const fileData = new Map<string, { file: FileMetadata; symbols: Symbol[]; imports: ImportInfo[] }>();

    const filePaths = this.walkDir(this.repoDir);

    for (const filePath of filePaths) {
      const relativePath = relative(this.repoDir, filePath);
      const content = this.safeRead(filePath);
      if (!content) continue;

      const ext = extname(filePath);
      const language = this.getLanguage(ext);
      const contentHash = this.simpleHash(content);

      const fileMeta: FileMetadata = {
        repo_id: this.repoId,
        path: relativePath,
        language,
        size: Buffer.byteLength(content, "utf-8"),
        content_hash: contentHash,
      };
      files.push(fileMeta);

      const fileSymbols = this.extractSymbols(content, ext);
      for (const sym of fileSymbols) {
        symbols.push({ ...sym, file_id: undefined });
      }

      const fileImports = this.extractImports(content, ext);
      imports.push(...fileImports);

      fileData.set(relativePath, {
        file: fileMeta,
        symbols: fileSymbols.map((s) => ({ ...s, file_id: undefined })),
        imports: fileImports,
      });
    }

    return { files, symbols, imports, fileData };
  }

  private walkDir(dir: string): string[] {
    const results: string[] = [];
    const stack: string[] = [dir];

    while (stack.length > 0) {
      const current = stack.pop()!;
      let entries: string[];
      try {
        entries = readdirSync(current);
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (SKIP_DIRS.has(entry)) continue;
        const fullPath = join(current, entry);
        try {
          const stat = statSync(fullPath);
          if (stat.isSymbolicLink()) continue;
          if (stat.isDirectory()) {
            stack.push(fullPath);
          } else if (stat.isFile() && SUPPORTED_EXTENSIONS.has(extname(entry))) {
            results.push(fullPath);
          }
        } catch {
          continue;
        }
      }
    }

    return results;
  }

  private safeRead(filePath: string): string | null {
    try {
      const stat = statSync(filePath);
      if (stat.size > MAX_FILE_SIZE) return null;
      return readFileSync(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  private getLanguage(ext: string): string | null {
    const map: Record<string, string> = {
      ".ts": "typescript",
      ".tsx": "typescript",
      ".js": "javascript",
      ".jsx": "javascript",
      ".mjs": "javascript",
      ".cjs": "javascript",
      ".py": "python",
      ".rb": "ruby",
      ".go": "go",
      ".rs": "rust",
      ".java": "java",
    };
    return map[ext] || null;
  }

  private extractSymbols(content: string, ext: string): Symbol[] {
    const symbols: Symbol[] = [];
    const lines = content.split("\n");

    if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // Functions
        const fnMatch = line.match(
          /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
        );
        if (fnMatch) {
          symbols.push({
            name: fnMatch[1],
            kind: "function",
            signature: this.extractSignature(lines, i),
            start_line: lineNum,
            end_line: this.findEndLine(lines, i),
            doc_comment: this.findDocComment(lines, i),
            is_exported: line.includes("export"),
          });
          continue;
        }

        // Arrow functions / const assignments
        const arrowMatch = line.match(
          /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*\S+)?\s*=\s*(?:async\s+)?(?:\(|function)/,
        );
        if (arrowMatch) {
          symbols.push({
            name: arrowMatch[1],
            kind: "function",
            signature: this.extractSignature(lines, i),
            start_line: lineNum,
            end_line: this.findEndLine(lines, i),
            doc_comment: this.findDocComment(lines, i),
            is_exported: line.includes("export"),
          });
          continue;
        }

        // Interfaces
        const ifaceMatch = line.match(
          /^(?:export\s+)?interface\s+(\w+)/,
        );
        if (ifaceMatch) {
          symbols.push({
            name: ifaceMatch[1],
            kind: "interface",
            signature: this.extractBlock(lines, i),
            start_line: lineNum,
            end_line: this.findBlockEnd(lines, i),
            doc_comment: this.findDocComment(lines, i),
            is_exported: line.includes("export"),
          });
          continue;
        }

        // Types
        const typeMatch = line.match(
          /^(?:export\s+)?type\s+(\w+)/,
        );
        if (typeMatch) {
          symbols.push({
            name: typeMatch[1],
            kind: "type",
            signature: this.extractBlock(lines, i),
            start_line: lineNum,
            end_line: this.findBlockEnd(lines, i),
            doc_comment: this.findDocComment(lines, i),
            is_exported: line.includes("export"),
          });
          continue;
        }

        // Classes
        const classMatch = line.match(
          /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/,
        );
        if (classMatch) {
          symbols.push({
            name: classMatch[1],
            kind: "class",
            signature: this.extractBlock(lines, i),
            start_line: lineNum,
            end_line: this.findBlockEnd(lines, i),
            doc_comment: this.findDocComment(lines, i),
            is_exported: line.includes("export"),
          });
          continue;
        }

        // Enums
        const enumMatch = line.match(
          /^(?:export\s+)?(?:const\s+)?enum\s+(\w+)/,
        );
        if (enumMatch) {
          symbols.push({
            name: enumMatch[1],
            kind: "enum",
            signature: this.extractBlock(lines, i),
            start_line: lineNum,
            end_line: this.findBlockEnd(lines, i),
            doc_comment: this.findDocComment(lines, i),
            is_exported: line.includes("export"),
          });
          continue;
        }

        // Constants
        const constMatch = line.match(
          /^(?:export\s+)?const\s+(\w+)\s*(?::\s*\S+)?\s*=/,
        );
        if (constMatch && !arrowMatch) {
          symbols.push({
            name: constMatch[1],
            kind: "const",
            signature: line.trim(),
            start_line: lineNum,
            end_line: lineNum,
            doc_comment: this.findDocComment(lines, i),
            is_exported: line.includes("export"),
          });
        }
      }
    }

    if (ext === ".py") {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        const defMatch = line.match(/^(?:async\s+)?def\s+(\w+)\s*\(/);
        if (defMatch) {
          symbols.push({
            name: defMatch[1],
            kind: "function",
            signature: line.trim(),
            start_line: lineNum,
            end_line: this.findEndLine(lines, i),
            doc_comment: this.findPythonDocstring(lines, i),
            is_exported: !defMatch[1].startsWith("_"),
          });
          continue;
        }

        const classMatch = line.match(/^class\s+(\w+)/);
        if (classMatch) {
          symbols.push({
            name: classMatch[1],
            kind: "class",
            signature: line.trim(),
            start_line: lineNum,
            end_line: this.findBlockEnd(lines, i),
            doc_comment: this.findPythonDocstring(lines, i),
            is_exported: !classMatch[1].startsWith("_"),
          });
        }
      }
    }

    return symbols;
  }

  private extractImports(content: string, ext: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();

      // TypeScript/JavaScript imports
      const tsImport = trimmed.match(
        /^import\s+(?:(?:type\s+)?(?:{[^}]+}|[\w*]+(?:\s*,\s*{[^}]+})?)\s+from\s+)?["']([^"']+)["']/,
      );
      if (tsImport) {
        imports.push(this.parseImportPath(tsImport[1], trimmed.includes("import type")));
        continue;
      }

      // CommonJS require
      const requireMatch = trimmed.match(/require\s*\(\s*["']([^"']+)["']\s*\)/);
      if (requireMatch) {
        imports.push(this.parseImportPath(requireMatch[1], false));
      }

      // Python imports
      const pyImport = trimmed.match(
        /^(?:from\s+(\S+)\s+)?import\s+(\S+)/,
      );
      if (pyImport && pyImport[1]) {
        imports.push(this.parseImportPath(pyImport[1], false));
      }
    }

    return imports;
  }

  private parseImportPath(importPath: string, isTypeOnly: boolean): ImportInfo {
    let source: ImportInfo["source"] = "npm";
    if (importPath.startsWith(".")) source = "relative";
    else if (importPath.startsWith("@repo/")) source = "org-package";
    else source = "npm";

    return {
      source,
      target: importPath,
      import_path: importPath,
      is_type_only: isTypeOnly,
    };
  }

  private extractSignature(lines: string[], startIdx: number): string {
    let sig = "";
    for (let i = startIdx; i < Math.min(startIdx + 5, lines.length); i++) {
      sig += lines[i].trim();
      if (lines[i].includes("{")) break;
    }
    return sig.substring(0, 200);
  }

  private extractBlock(lines: string[], startIdx: number): string {
    return lines[startIdx]?.trim().substring(0, 200) || "";
  }

  private findEndLine(lines: string[], startIdx: number): number {
    let braces = 0;
    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];
      let inString: string | null = null;
      let escaped = false;
      let inLineComment = false;

      for (let j = 0; j < line.length; j++) {
        const ch = line[j];

        if (inLineComment) break;

        if (escaped) {
          escaped = false;
          continue;
        }

        if (ch === "\\") {
          escaped = true;
          continue;
        }

        if (inString) {
          if (ch === inString) inString = null;
          continue;
        }

        if (ch === '"' || ch === "'" || ch === "`") {
          inString = ch;
          continue;
        }

        if (ch === "/" && j + 1 < line.length && line[j + 1] === "/") {
          inLineComment = true;
          continue;
        }

        if (ch === "{") braces++;
        if (ch === "}") braces--;
      }
      if (braces === 0 && i > startIdx) return i + 1;
    }
    return Math.min(startIdx + 20, lines.length);
  }

  private findBlockEnd(lines: string[], startIdx: number): number {
    return this.findEndLine(lines, startIdx);
  }

  private findDocComment(lines: string[], targetIdx: number): string | null {
    const commentLines: string[] = [];
    let i = targetIdx - 1;

    while (i >= 0) {
      const line = lines[i].trim();
      if (line.startsWith("*/")) {
        i--;
        while (i >= 0) {
          const cl = lines[i].trim();
          if (cl.startsWith("/**") || cl.startsWith("/*")) break;
          commentLines.unshift(lines[i]);
          i--;
        }
        break;
      } else if (line.startsWith("//")) {
        commentLines.unshift(lines[i]);
        i--;
      } else {
        break;
      }
    }

    return commentLines.length > 0 ? commentLines.join("\n").substring(0, 500) : null;
  }

  private findPythonDocstring(lines: string[], defIdx: number): string | null {
    const nextLine = lines[defIdx + 1]?.trim();
    if (nextLine?.startsWith('"""') || nextLine?.startsWith("'''")) {
      const quote = nextLine.substring(0, 3);
      if (nextLine.endsWith(quote) && nextLine.length > 3) {
        return nextLine.substring(3, nextLine.length - 3);
      }
      for (let i = defIdx + 2; i < lines.length; i++) {
        if (lines[i].trim().endsWith(quote)) {
          return lines
            .slice(defIdx + 2, i)
            .join("\n")
            .substring(0, 500);
        }
      }
    }
    return null;
  }

  private simpleHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return hash.toString(36);
  }
}
