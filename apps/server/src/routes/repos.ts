import { Hono } from "hono";
import type { Bindings } from "../types";

export const repoRoutes = new Hono<{ Bindings: Bindings }>();

repoRoutes.get("/", async (c) => {
  return c.json({ message: "Repo management - Coming soon" });
});

repoRoutes.post("/sync", async (c) => {
  return c.json({
    status: "queued",
    message: "Repo sync queued. Use the CLI for V1: coders-eye index",
  });
});
