import { readFileSync } from "node:fs";
import { join } from "node:path";
import { IndexStore } from "@repo/indexer";
import type { GitHubFile, CrossRepoMatch, Symbol } from "@repo/types";

export interface ContextBuilderOptions {
  dataDir: string;
  orgReposPath?: string;
}

export interface PRContext {
  repoFullName: string;
  prNumber: number;
  files: GitHubFile[];
}

export interface BuiltContext {
  prDiff: string;
  crossRepoMatches: CrossRepoMatch[];
  summary: string;
}

const MAX_MATCHES = 500;

export class ContextBuilder {
  private store: IndexStore;

  constructor(dataDir: string) {
    this.store = new IndexStore(dataDir);
  }

  buildPRContext(
    prContext: PRContext,
    prDiff: string,
  ): BuiltContext {
    const matches: CrossRepoMatch[] = [];

    for (const file of prContext.files) {
      if (!file.patch) continue;

      const fileMatches = this.findRelatedCode(
        file.filename,
        file.patch,
        prContext.repoFullName,
      );
      matches.push(...fileMatches);
    }

    const symbolMatches = this.findRelatedBySymbols(
      prContext.files,
      prContext.repoFullName,
    );
    matches.push(...symbolMatches);

    const importMatches = this.findRelatedByImports(
      prContext.files,
      prContext.repoFullName,
    );
    matches.push(...importMatches);

    const deduped = this.deduplicateMatches(matches).slice(0, MAX_MATCHES);

    const summary = this.buildSummary(deduped);

    return {
      prDiff,
      crossRepoMatches: deduped,
      summary,
    };
  }

  private findRelatedCode(
    filename: string,
    patch: string,
    excludeRepo: string,
  ): CrossRepoMatch[] {
    const matches: CrossRepoMatch[] = [];
    const addedLines = this.extractAddedLines(patch);

    for (const line of addedLines) {
      const identifiers = this.extractIdentifiers(line);
      for (const id of identifiers) {
        const found = this.store.findSimilarSymbols(id, excludeRepo, 5);
        for (const sym of found) {
          matches.push({
            repo_name: sym.repo_name,
            file_path: sym.file_path,
            symbol: {
              name: sym.name,
              kind: sym.kind as Symbol["kind"],
              signature: sym.signature,
              start_line: sym.start_line,
              end_line: sym.end_line,
              doc_comment: sym.doc_comment,
              is_exported: !!sym.is_exported,
            },
            relevance: this.calculateRelevance(id, sym.name),
          });
        }
      }
    }

    return matches;
  }

  private findRelatedBySymbols(
    files: GitHubFile[],
    excludeRepo: string,
  ): CrossRepoMatch[] {
    const matches: CrossRepoMatch[] = [];

    for (const file of files) {
      const name = this.extractBaseName(file.filename);
      if (!name || name.length < 3) continue;

      const found = this.store.findSimilarSymbols(name, excludeRepo, 3);
      for (const sym of found) {
        matches.push({
          repo_name: sym.repo_name,
          file_path: sym.file_path,
          symbol: {
            name: sym.name,
            kind: sym.kind as Symbol["kind"],
            signature: sym.signature,
            start_line: sym.start_line,
            end_line: sym.end_line,
            doc_comment: sym.doc_comment,
            is_exported: !!sym.is_exported,
          },
          relevance: 0.6,
        });
      }
    }

    return matches;
  }

  private findRelatedByImports(
    files: GitHubFile[],
    excludeRepo: string,
  ): CrossRepoMatch[] {
    const matches: CrossRepoMatch[] = [];

    for (const file of files) {
      if (!file.patch) continue;
      const addedImports = this.extractAddedImports(file.patch);

      for (const imp of addedImports) {
        const importers = this.store.findImportsByTarget(imp);
        for (const impInfo of importers) {
          if (impInfo.repo_name === excludeRepo) continue;
          matches.push({
            repo_name: impInfo.repo_name,
            file_path: impInfo.file_path,
            symbol: {
              name: impInfo.target,
              kind: "function",
              signature: `imported from ${impInfo.import_path}`,
              start_line: 0,
              end_line: 0,
              doc_comment: null,
              is_exported: true,
            },
            relevance: 0.8,
          });
        }
      }
    }

    return matches;
  }

  private extractAddedLines(patch: string): string[] {
    return patch
      .split("\n")
      .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
      .map((line) => line.substring(1));
  }

  private extractIdentifiers(line: string): string[] {
    const identifiers: string[] = [];
    const words = line.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g) || [];

    const keywords = new Set([
      "const", "let", "var", "function", "return", "if", "else", "for",
      "while", "class", "import", "export", "from", "async", "await",
      "try", "catch", "throw", "new", "this", "super", "typeof", "instanceof",
      "null", "undefined", "true", "false", "void", "delete", "in", "of",
      "switch", "case", "break", "continue", "default", "do", "yield",
      "type", "interface", "enum", "extends", "implements", "abstract",
      "public", "private", "protected", "static", "readonly", "as",
      "def", "elif", "except", "finally", "with", "as", "lambda",
      "pass", "raise", "assert", "del", "global", "nonlocal", "yield",
      "True", "False", "None", "and", "or", "not", "is",
    ]);

    for (const word of words) {
      if (word.length >= 3 && !keywords.has(word) && !/^\d/.test(word)) {
        identifiers.push(word);
      }
    }

    return [...new Set(identifiers)].slice(0, 20);
  }

  private extractAddedImports(patch: string): string[] {
    const imports: string[] = [];
    const lines = patch.split("\n");

    for (const line of lines) {
      if (!line.startsWith("+")) continue;
      const content = line.substring(1);

      const fromMatch = content.match(/from\s+["']([^"']+)["']/);
      if (fromMatch) imports.push(fromMatch[1]);

      const requireMatch = content.match(/require\s*\(\s*["']([^"']+)["']\s*\)/);
      if (requireMatch) imports.push(requireMatch[1]);
    }

    return [...new Set(imports)];
  }

  private extractBaseName(filename: string): string | null {
    const parts = filename.split("/");
    const last = parts[parts.length - 1];
    const name = last.replace(/\.[^.]+$/, "");
    return name || null;
  }

  private calculateRelevance(query: string, match: string): number {
    if (query === match) return 1.0;
    if (match.includes(query) || query.includes(match)) return 0.9;

    const qLower = query.toLowerCase();
    const mLower = match.toLowerCase();
    if (qLower === mLower) return 0.95;

    let matches = 0;
    const maxLen = Math.max(qLower.length, mLower.length);
    for (let i = 0; i < Math.min(qLower.length, mLower.length); i++) {
      if (qLower[i] === mLower[i]) matches++;
    }
    return 0.3 + (matches / maxLen) * 0.5;
  }

  private deduplicateMatches(matches: CrossRepoMatch[]): CrossRepoMatch[] {
    const sorted = matches.sort((a, b) => b.relevance - a.relevance);
    const seen = new Set<string>();
    return sorted.filter((m) => {
      const key = `${m.repo_name}:${m.file_path}:${m.symbol.name}:${m.symbol.kind}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private buildSummary(matches: CrossRepoMatch[]): string {
    if (matches.length === 0) {
      return "No cross-repository context found for this PR.";
    }

    const byRepo = new Map<string, CrossRepoMatch[]>();
    for (const m of matches) {
      const existing = byRepo.get(m.repo_name) || [];
      existing.push(m);
      byRepo.set(m.repo_name, existing);
    }

    const parts: string[] = [`Found ${matches.length} cross-repository references:`];

    for (const [repo, repoMatches] of byRepo) {
      const symbols = repoMatches.map((m) => `${m.symbol.name} (${m.symbol.kind})`);
      parts.push(`  - ${repo}: ${symbols.join(", ")}`);
    }

    return parts.join("\n");
  }

  buildContextPrompt(builtContext: BuiltContext): string {
    const parts: string[] = [];

    if (builtContext.crossRepoMatches.length > 0) {
      parts.push("## Cross-Repository Context");
      parts.push(
        "The following code from OTHER repositories in the same organization is relevant to this PR:",
      );

      const byRepo = new Map<string, CrossRepoMatch[]>();
      for (const m of builtContext.crossRepoMatches) {
        const existing = byRepo.get(m.repo_name) || [];
        existing.push(m);
        byRepo.set(m.repo_name, existing);
      }

      for (const [repo, matches] of byRepo) {
        parts.push(`\n### From ${repo}`);
        for (const m of matches.slice(0, 10)) {
          parts.push(`- **${m.symbol.name}** (${m.symbol.kind})`);
          if (m.symbol.signature) {
            parts.push(`  Signature: \`${m.symbol.signature}\``);
          }
          if (m.symbol.doc_comment) {
            parts.push(`  Doc: ${m.symbol.doc_comment.substring(0, 200)}`);
          }
          parts.push(`  File: ${m.file_path}:${m.symbol.start_line}`);
        }
      }
    }

    return parts.join("\n");
  }

  close(): void {
    this.store.close();
  }
}
