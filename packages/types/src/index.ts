export interface GitHubPR {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  html_url: string;
  diff_url: string;
  patch_url: string;
  head: {
    sha: string;
    ref: string;
    repo: {
      full_name: string;
    } | null;
  };
  base: {
    sha: string;
    ref: string;
    repo: {
      full_name: string;
    };
  };
  user: {
    login: string;
    avatar_url: string;
  };
  changed_files: number;
  additions: number;
  deletions: number;
  created_at: string;
  updated_at: string;
}

export interface GitHubFile {
  filename: string;
  status: "added" | "removed" | "modified" | "renamed" | "copied" | "changed";
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  fork: boolean;
  html_url: string;
  clone_url: string;
  default_branch: string;
  language: string | null;
  description: string | null;
}

export interface Symbol {
  id?: number;
  file_id?: number;
  name: string;
  kind: "function" | "type" | "interface" | "class" | "const" | "enum" | "method" | "variable";
  signature: string | null;
  start_line: number;
  end_line: number;
  doc_comment: string | null;
  is_exported: boolean;
}

export interface FileMetadata {
  id?: number;
  repo_id?: number;
  path: string;
  language: string | null;
  size: number;
  content_hash: string;
}

export interface ImportInfo {
  file_id?: number;
  source: "local" | "npm" | "org-package" | "relative";
  target: string;
  import_path: string;
  is_type_only: boolean;
}

export interface CrossRepoMatch {
  repo_name: string;
  file_path: string;
  symbol: Symbol;
  relevance: number;
}

export interface ReviewComment {
  file: string;
  line?: number;
  severity: "error" | "warning" | "info" | "suggestion";
  category: "bug" | "security" | "performance" | "style" | "architecture" | "breaking-change";
  message: string;
  suggestion?: string;
  cross_repo_context?: string;
}

export interface ReviewResult {
  summary: string;
  severity: "critical" | "warning" | "info";
  comments: ReviewComment[];
}

export interface ReviewOutput {
  pr_number: number;
  repo_full_name: string;
  status: "pending" | "running" | "completed" | "failed";
  result: ReviewResult | null;
  raw_output: string;
  duration_ms: number;
  created_at: string;
  post_to_github?: boolean;
}

export interface IndexStats {
  repos_indexed: number;
  files_indexed: number;
  symbols_indexed: number;
  last_indexed_at: string | null;
}

export interface CodersEyeConfig {
  github_token: string;
  org: string;
  claude_path: string;
  data_dir: string;
}
