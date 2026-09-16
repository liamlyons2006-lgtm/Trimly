import type { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { logger } from "../lib/logger";

// Shared-secret gate for the Plaid endpoints. Trimly has no account system, so
// this token is the only thing standing between a public deployment URL and
// someone else's bank connection. Generate one with `openssl rand -hex 32`.
const rawToken = process.env["APP_AUTH_TOKEN"]?.trim();

if (!rawToken) {
  throw new Error(
    "APP_AUTH_TOKEN environment variable is required but was not provided. " +
      "Generate one with `openssl rand -hex 32` and set it before starting the server.",
  );
}

const expected = Buffer.from(rawToken);

function isValidToken(candidate: string): boolean {
  const provided = Buffer.from(candidate);
  // Buffers must be equal length before timingSafeEqual; checked here so a
  // mismatched length short-circuits instead of throwing.
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token || !isValidToken(token)) {
    logger.warn({ path: req.path }, "Rejected request with missing or invalid auth token");
    res.status(401).json({ error: "unauthorized", message: "Missing or invalid access token." });
    return;
  }

  next();
}
