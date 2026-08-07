import { Hono } from "hono";
import { GitHubClient } from "@repo/github";
import type { Bindings } from "../types";

export const webhookRoutes = new Hono<{ Bindings: Bindings }>();

webhookRoutes.post("/github", async (c) => {
  const secret = c.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return c.json({ error: "Webhook secret not configured" }, 500);
  }

  const signature = c.req.header("x-hub-signature-256");
  if (!signature) {
    return c.json({ error: "Missing signature" }, 401);
  }

  const deliveryId = c.req.header("x-github-delivery");
  if (c.env.KV && deliveryId) {
    const existing = await c.env.KV.get(`webhook:${deliveryId}`);
    if (existing) {
      return c.json({ received: true, duplicate: true });
    }
    await c.env.KV.put(`webhook:${deliveryId}`, "1", { expirationTtl: 3600 });
  }

  let payload: string;
  try {
    payload = await c.req.text();
  } catch {
    return c.json({ error: "Failed to read request body" }, 400);
  }

  const github = new GitHubClient(c.env.GITHUB_TOKEN);
  const isValid = await github.verifyWebhookSignature(payload, signature, secret);

  if (!isValid) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const event = c.req.header("x-github-event");

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(payload);
  } catch {
    return c.json({ error: "Invalid JSON payload" }, 400);
  }

  if (event === "pull_request") {
    const action = body.action;
    const pr = body.pull_request as Record<string, unknown> | undefined;
    const repository = body.repository as Record<string, unknown> | undefined;

    if ((action === "opened" || action === "synchronize") && pr && repository) {
      const prNumber = pr.number;
      const repoFullName = repository.full_name;

      console.log(
        `Webhook received: PR #${prNumber} ${action} on ${repoFullName}`,
      );

      return c.json({
        received: true,
        pr: prNumber,
        repo: repoFullName,
        action,
        message: "Review queued",
      });
    }
  }

  return c.json({ received: true, event });
});
