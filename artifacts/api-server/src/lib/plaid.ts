import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { logger } from "./logger";

// Centralises Plaid configuration and client creation. Secrets are read from
// the environment and never leave the server. When credentials are absent the
// module reports `not_configured` so callers can surface an honest state
// instead of pretending a connection exists.

export type PlaidConfig = {
  clientId: string;
  secret: string;
  env: "sandbox" | "production";
};

export type PlaidConfigResult =
  | { ok: true; config: PlaidConfig }
  | { ok: false; reason: "not_configured"; missing: string[] };

const ALLOWED_ENVS = ["sandbox", "production"] as const;

function resolveEnv(raw: string | undefined): PlaidConfig["env"] {
  const value = (raw ?? "sandbox").trim().toLowerCase();
  return (ALLOWED_ENVS as readonly string[]).includes(value)
    ? (value as PlaidConfig["env"])
    : "sandbox";
}

// Reads and validates Plaid env vars. Does not throw: a missing configuration
// is a normal, expected state for a build without credentials yet.
export function loadPlaidConfig(): PlaidConfigResult {
  const clientId = process.env["PLAID_CLIENT_ID"]?.trim();
  const secret = process.env["PLAID_SECRET"]?.trim();

  const missing: string[] = [];
  if (!clientId) missing.push("PLAID_CLIENT_ID");
  if (!secret) missing.push("PLAID_SECRET");

  if (missing.length > 0 || !clientId || !secret) {
    return { ok: false, reason: "not_configured", missing };
  }

  return {
    ok: true,
    config: { clientId, secret, env: resolveEnv(process.env["PLAID_ENV"]) },
  };
}

// Builds a Plaid API client from a validated config. The client id and secret
// are sent as Plaid's required headers on every request.
export function createPlaidClient(config: PlaidConfig): PlaidApi {
  const basePath = PlaidEnvironments[config.env];
  const configuration = new Configuration({
    basePath,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": config.clientId,
        "PLAID-SECRET": config.secret,
      },
    },
  });
  return new PlaidApi(configuration);
}

// A lazily-initialised singleton so we build the client at most once. Returns
// null when Plaid is not configured; routes translate that into a clear
// `not_configured` response.
let cached: { client: PlaidApi; config: PlaidConfig } | null = null;
let resolved = false;

export function getPlaidClient(): { client: PlaidApi; config: PlaidConfig } | null {
  if (resolved) return cached;
  resolved = true;

  const result = loadPlaidConfig();
  if (!result.ok) {
    logger.warn(
      { missing: result.missing },
      "Plaid is not configured; bank connector endpoints will report not_configured",
    );
    cached = null;
    return null;
  }

  const client = createPlaidClient(result.config);
  logger.info({ env: result.config.env }, "Plaid client initialised");
  cached = { client, config: result.config };
  return cached;
}

// Test/hook seam so a reconfiguration (or tests) can force a re-read.
export function resetPlaidClientCache(): void {
  cached = null;
  resolved = false;
}
