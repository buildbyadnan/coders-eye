import { Hono } from "hono";
import type { Bindings } from "../types";

export const reviewRoutes = new Hono<{ Bindings: Bindings }>();

reviewRoutes.get("/", async (c) => {
  return c.json({ message: "Review API - Coming soon" });
});

reviewRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const { pr_url } = body;

  if (!pr_url) {
    return c.json({ error: "pr_url is required" }, 400);
  }

  // In V1, this endpoint is a placeholder
  // Full implementation will use the @repo/review package
  return c.json({
    status: "queued",
    message: "Review queued. Use the CLI for V1: coders-eye review <pr-url>",
  });
});
