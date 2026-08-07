import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { bodyLimit } from "hono/body-limit";
import { webhookRoutes } from "./routes/webhook";
import { reviewRoutes } from "./routes/review";
import { repoRoutes } from "./routes/repos";
import { healthRoutes } from "./routes/health";
import type { Bindings, Variables } from "./types";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const MAX_BODY_BYTES = 1024 * 1024;

app.use("/*", logger());
app.use("/*", bodyLimit({ maxSize: MAX_BODY_BYTES }));

app.use("/*", async (c, next) => {
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("Content-Security-Policy", "default-src 'none'");

  const requestId = crypto.randomUUID();
  c.header("X-Request-Id", requestId);
  c.set("requestId", requestId);

  const allowedOrigins = (c.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o: string) => o.trim())
    .filter(Boolean);

  return cors({
    origin: (origin) => {
      if (allowedOrigins.length === 0) return null;
      return allowedOrigins.includes(origin) ? origin : null;
    },
    credentials: true,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Hub-Signature-256"],
    maxAge: 86400,
  })(c, next);
});

app.route("/", healthRoutes);
app.route("/webhook", webhookRoutes);
app.route("/api/reviews", reviewRoutes);
app.route("/api/repos", repoRoutes);

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  const requestId = c.get("requestId");
  return c.json({ error: "Internal Server Error", requestId }, 500);
});

app.notFound((c) => c.json({ error: "Not Found" }, 404));

export default app;
