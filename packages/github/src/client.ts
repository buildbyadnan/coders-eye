import { fetchWithTimeout, hmacHex, constantTimeCompare } from "@repo/http";
import type { GitHubPR, GitHubFile, GitHubRepo } from "@repo/types";

export class GitHubClient {
  private token: string;
  private baseUrl = "https://api.github.com";

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(path: string): Promise<T> {
    const response = await fetchWithTimeout(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      timeout: 30_000,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error ${response.status}: ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async getPR(owner: string, repo: string, prNumber: number): Promise<GitHubPR> {
    return this.request<GitHubPR>(
      `/repos/${owner}/${repo}/pulls/${prNumber}`,
    );
  }

  async getPRFiles(owner: string, repo: string, prNumber: number): Promise<GitHubFile[]> {
    const files: GitHubFile[] = [];
    let page = 1;
    const maxPages = 100;

    while (page <= maxPages) {
      const batch = await this.request<GitHubFile[]>(
        `/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`,
      );
      files.push(...batch);
      if (batch.length < 100) break;
      page++;
    }

    return files;
  }

  async getPRDiff(owner: string, repo: string, prNumber: number): Promise<string> {
    const response = await fetchWithTimeout(
      `${this.baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/vnd.github.v3.diff",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch diff: ${response.status}`);
    }

    return response.text();
  }

  async getOrgRepos(org: string): Promise<GitHubRepo[]> {
    const repos: GitHubRepo[] = [];
    let page = 1;
    const maxPages = 100;

    while (page <= maxPages) {
      const batch = await this.request<GitHubRepo[]>(
        `/orgs/${org}/repos?type=all&per_page=100&page=${page}`,
      );
      repos.push(...batch);
      if (batch.length < 100) break;
      page++;
    }

    return repos;
  }

  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    return this.request<GitHubRepo>(`/repos/${owner}/${repo}`);
  }

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Promise<string> {
    const refParam = ref ? `?ref=${ref}` : "";
    const response = await fetchWithTimeout(
      `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}${refParam}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`);
    }

    const data = (await response.json()) as { content: string; encoding: string };
    if (data.encoding === "base64") {
      const binary = atob(data.content);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    }
    return data.content;
  }

  async postPRComment(
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
  ): Promise<void> {
    const response = await fetchWithTimeout(
      `${this.baseUrl}/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ body }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to post PR comment: ${response.status} ${error}`);
    }
  }

  parsePRUrl(url: string): { owner: string; repo: string; prNumber: number } | null {
    const match = url.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)$/);
    if (!match) return null;
    return { owner: match[1], repo: match[2], prNumber: parseInt(match[3], 10) };
  }

  async verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): Promise<boolean> {
    const expected = `sha256=${await hmacHex(secret, payload)}`;
    return constantTimeCompare(expected, signature);
  }
}
