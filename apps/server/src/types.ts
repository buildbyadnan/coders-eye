export {};

declare global {
  interface D1Database {
    prepare(query: string): D1PreparedStatement;
    exec(query: string): Promise<{ results: unknown[] }>;
    batch(stmts: D1PreparedStatement[]): Promise<unknown>;
  }

  interface D1PreparedStatement {
    bind(...args: unknown[]): D1PreparedStatement;
    first<T = Record<string, unknown>>(): Promise<T | null>;
    all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
    run(): Promise<{ changes: number }>;
  }

  interface KVNamespace {
    get(key: string, type?: "text" | "json" | "arrayBuffer" | "stream"): Promise<unknown>;
    put(key: string, value: unknown, options?: { expirationTtl?: number }): Promise<void>;
    delete(key: string): Promise<void>;
  }

  interface Fetcher {
    fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
  }

  interface Env {
    DB: D1Database;
    KV?: KVNamespace;
    GITHUB_WEBHOOK_SECRET: string;
    GITHUB_TOKEN: string;
    CLAUDE_PATH: string;
    ALLOWED_ORIGINS: string;
    DATA_DIR: string;
  }
}

export type Bindings = Env;

export type Variables = {
  requestId: string;
};
