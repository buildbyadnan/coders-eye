import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import type { Symbol, FileMetadata, ImportInfo, IndexStats } from "@repo/types";

export interface DbFile {
  id: number;
  repo_id: number;
  path: string;
  language: string | null;
  size: number;
  content_hash: string;
  last_indexed_at: string;
}

export interface DbSymbol {
  id: number;
  file_id: number;
  name: string;
  kind: string;
  signature: string | null;
  start_line: number;
  end_line: number;
  doc_comment: string | null;
  is_exported: number;
}

export interface DbImport {
  id: number;
  file_id: number;
  source: string;
  target: string;
  import_path: string;
  is_type_only: number;
}

export interface DbRepo {
  id: number;
  github_id: number;
  name: string;
  full_name: string;
  default_branch: string;
  language: string | null;
  description: string | null;
  is_private: number;
  clone_url: string | null;
  last_indexed_at: string | null;
}

export class IndexStore {
  private dbPath: string;
  private db: InstanceType<typeof Database>;

  constructor(dataDir: string) {
    const dbDir = join(dataDir, "db");
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
    this.dbPath = join(dbDir, "coders-eye.db");
    this.db = this.initDb();
  }

  private initDb(): InstanceType<typeof Database> {
    const db = new Database(this.dbPath);

    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    db.exec(`
      CREATE TABLE IF NOT EXISTS repos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        github_id INTEGER UNIQUE NOT NULL,
        name TEXT NOT NULL,
        full_name TEXT NOT NULL,
        default_branch TEXT NOT NULL DEFAULT 'main',
        language TEXT,
        description TEXT,
        is_private INTEGER NOT NULL DEFAULT 1,
        clone_url TEXT,
        last_indexed_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
        path TEXT NOT NULL,
        language TEXT,
        size INTEGER,
        content_hash TEXT,
        last_indexed_at TEXT DEFAULT (datetime('now')),
        UNIQUE(repo_id, path)
      );

      CREATE TABLE IF NOT EXISTS symbols (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        signature TEXT,
        start_line INTEGER,
        end_line INTEGER,
        doc_comment TEXT,
        is_exported INTEGER NOT NULL DEFAULT 0,
        UNIQUE(file_id, name, kind)
      );

      CREATE TABLE IF NOT EXISTS imports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
        source TEXT NOT NULL,
        target TEXT NOT NULL,
        import_path TEXT NOT NULL,
        is_type_only INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pr_number INTEGER NOT NULL,
        repo_full_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        summary TEXT,
        file_count INTEGER,
        review_json TEXT,
        claude_raw_output TEXT,
        duration_ms INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        completed_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_files_repo ON files(repo_id);
      CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
      CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);
      CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
      CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);
      CREATE INDEX IF NOT EXISTS idx_imports_file ON imports(file_id);
      CREATE INDEX IF NOT EXISTS idx_imports_target ON imports(target);
      CREATE INDEX IF NOT EXISTS idx_reviews_repo ON reviews(repo_full_name);
      CREATE INDEX IF NOT EXISTS idx_reviews_pr ON reviews(pr_number);
    `);

    return db;
  }

  upsertRepo(repo: {
    github_id: number;
    name: string;
    full_name: string;
    default_branch: string;
    language: string | null;
    description: string | null;
    is_private: boolean;
    clone_url: string;
  }): number {
    const existing = this.db
      .prepare("SELECT id FROM repos WHERE github_id = ?")
      .get(repo.github_id) as { id: number } | undefined;

    if (existing) {
      this.db
        .prepare(
          `UPDATE repos SET name = ?, full_name = ?, default_branch = ?,
           language = ?, description = ?, is_private = ?, clone_url = ?, updated_at = datetime('now')
           WHERE github_id = ?`,
        )
        .run(
          repo.name,
          repo.full_name,
          repo.default_branch,
          repo.language,
          repo.description,
          repo.is_private ? 1 : 0,
          repo.clone_url,
          repo.github_id,
        );
      return existing.id;
    }

    const result = this.db
      .prepare(
        `INSERT INTO repos (github_id, name, full_name, default_branch, language, description, is_private, clone_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        repo.github_id,
        repo.name,
        repo.full_name,
        repo.default_branch,
        repo.language,
        repo.description,
        repo.is_private ? 1 : 0,
        repo.clone_url,
      );
    return Number(result.lastInsertRowid);
  }

  clearRepoData(repoId: number): void {
    this.db.prepare("DELETE FROM files WHERE repo_id = ?").run(repoId);
  }

  upsertFiles(repoId: number, files: FileMetadata[]): Map<string, number> {
    const insert = this.db.prepare(
      `INSERT INTO files (repo_id, path, language, size, content_hash, last_indexed_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(repo_id, path) DO UPDATE SET
       language = excluded.language, size = excluded.size,
       content_hash = excluded.content_hash, last_indexed_at = datetime('now')`,
    );

    const getExisting = this.db.prepare(
      "SELECT id FROM files WHERE repo_id = ? AND path = ?",
    );

    const fileMap = new Map<string, number>();

    const transaction = this.db.transaction(() => {
      for (const file of files) {
        insert.run(repoId, file.path, file.language, file.size, file.content_hash);
        const row = getExisting.get(repoId, file.path) as { id: number } | undefined;
        if (row) fileMap.set(file.path, row.id);
      }
    });
    transaction();

    return fileMap;
  }

  insertSymbols(fileId: number, symbols: Symbol[]): void {
    const insert = this.db.prepare(
      `INSERT OR REPLACE INTO symbols (file_id, name, kind, signature, start_line, end_line, doc_comment, is_exported)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const transaction = this.db.transaction(() => {
      for (const sym of symbols) {
        insert.run(
          fileId,
          sym.name,
          sym.kind,
          sym.signature,
          sym.start_line,
          sym.end_line,
          sym.doc_comment,
          sym.is_exported ? 1 : 0,
        );
      }
    });
    transaction();
  }

  insertImports(fileId: number, imports: ImportInfo[]): void {
    const insert = this.db.prepare(
      `INSERT INTO imports (file_id, source, target, import_path, is_type_only)
       VALUES (?, ?, ?, ?, ?)`,
    );

    const transaction = this.db.transaction(() => {
      for (const imp of imports) {
        insert.run(fileId, imp.source, imp.target, imp.import_path, imp.is_type_only ? 1 : 0);
      }
    });
    transaction();
  }

  markRepoIndexed(repoId: number): void {
    this.db
      .prepare("UPDATE repos SET last_indexed_at = datetime('now') WHERE id = ?")
      .run(repoId);
  }

  searchSymbols(query: string, limit: number = 50): (DbSymbol & { repo_name: string; file_path: string })[] {
    const escaped = query.replace(/[%_]/g, "\\$&");
    return this.db
      .prepare(
        `SELECT s.*, r.full_name as repo_name, f.path as file_path
         FROM symbols s
         JOIN files f ON s.file_id = f.id
         JOIN repos r ON f.repo_id = r.id
         WHERE s.name LIKE ? ESCAPE '\\' OR s.signature LIKE ? ESCAPE '\\'
         LIMIT ?`,
      )
      .all(`%${escaped}%`, `%${escaped}%`, limit) as (DbSymbol & { repo_name: string; file_path: string })[];
  }

  findSimilarSymbols(
    name: string,
    excludeRepo: string,
    limit: number = 20,
  ): (DbSymbol & { repo_name: string; file_path: string })[] {
    return this.db
      .prepare(
        `SELECT s.*, r.full_name as repo_name, f.path as file_path
         FROM symbols s
         JOIN files f ON s.file_id = f.id
         JOIN repos r ON f.repo_id = r.id
         WHERE s.name = ? AND r.full_name != ?
         LIMIT ?`,
      )
      .all(name, excludeRepo, limit) as (DbSymbol & { repo_name: string; file_path: string })[];
  }

  findExportedSymbols(
    excludeRepo: string,
    limit: number = 100,
  ): (DbSymbol & { repo_name: string; file_path: string })[] {
    return this.db
      .prepare(
        `SELECT s.*, r.full_name as repo_name, f.path as file_path
         FROM symbols s
         JOIN files f ON s.file_id = f.id
         JOIN repos r ON f.repo_id = r.id
         WHERE s.is_exported = 1 AND r.full_name != ?
         ORDER BY s.name
         LIMIT ?`,
      )
      .all(excludeRepo, limit) as (DbSymbol & { repo_name: string; file_path: string })[];
  }

  findImportsByTarget(target: string): (DbImport & { repo_name: string; file_path: string })[] {
    const escaped = target.replace(/[%_]/g, "\\$&");
    return this.db
      .prepare(
        `SELECT i.*, r.full_name as repo_name, f.path as file_path
         FROM imports i
         JOIN files f ON i.file_id = f.id
         JOIN repos r ON f.repo_id = r.id
         WHERE i.target LIKE ? ESCAPE '\\'`,
      )
      .all(`%${escaped}%`) as (DbImport & { repo_name: string; file_path: string })[];
  }

  getRepoByFullName(fullName: string): DbRepo | undefined {
    return this.db.prepare("SELECT * FROM repos WHERE full_name = ?").get(fullName) as DbRepo | undefined;
  }

  getAllRepos(): DbRepo[] {
    return this.db.prepare("SELECT * FROM repos ORDER BY full_name").all() as DbRepo[];
  }

  getStats(): IndexStats {
    const repos = this.db.prepare("SELECT COUNT(*) as count FROM repos").get() as { count: number };
    const files = this.db.prepare("SELECT COUNT(*) as count FROM files").get() as { count: number };
    const symbols = this.db.prepare("SELECT COUNT(*) as count FROM symbols").get() as { count: number };
    const lastIndexed = this.db
      .prepare("SELECT MAX(last_indexed_at) as last FROM repos")
      .get() as { last: string | null };

    return {
      repos_indexed: repos.count,
      files_indexed: files.count,
      symbols_indexed: symbols.count,
      last_indexed_at: lastIndexed.last,
    };
  }

  close(): void {
    this.db.close();
  }
}
