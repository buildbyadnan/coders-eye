import { Hono } from "hono";
import type { Bindings } from "../types";

export const healthRoutes = new Hono<{ Bindings: Bindings }>();

healthRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "coders-eye",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
});
