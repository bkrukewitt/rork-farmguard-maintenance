import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";
import { checkRateLimit, getClientIdentifier } from "./utils/rate-limiter";

const app = new Hono();

const ALLOWED_ORIGINS = [
  'https://rork.app',
  'https://preview.rork.app',
  process.env.EXPO_PUBLIC_RORK_API_BASE_URL,
].filter(Boolean) as string[];

app.use("*", cors({
  origin: (origin) => {
    if (!origin) return ALLOWED_ORIGINS[0];
    if (ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed))) {
      return origin;
    }
    return ALLOWED_ORIGINS[0];
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

app.use("*", async (c, next) => {
  const clientId = getClientIdentifier(c.req.raw);
  const { allowed, remaining, resetAt } = checkRateLimit(clientId, 60, 60_000);

  c.header('X-RateLimit-Remaining', String(remaining));
  c.header('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

  if (!allowed) {
    console.log(`[RateLimit] Blocked request from ${clientId}`);
    return c.json({ error: 'Too many requests. Please try again later.' }, 429);
  }

  await next();
});

app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  }),
);

app.get("/", (c) => {
  return c.json({ status: "ok", message: "FarmGuard API is running" });
});

export default app;
