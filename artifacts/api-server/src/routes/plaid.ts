import { Router, type IRouter } from "express";
import { CountryCode, Products } from "plaid";
import { db, plaidItemsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  PlaidStatusResponse,
  PlaidCreateLinkTokenResponse,
  PlaidExchangeBody,
  PlaidSyncResponse,
  PlaidDisconnectResponse,
} from "@workspace/api-zod";
import { getPlaidClient } from "../lib/plaid";
import { streamsToSuggestions } from "../lib/plaid-mapping";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Returns the single connected item, if any. This is a single-user local app,
// so there is at most one row.
async function getStoredItem() {
  const rows = await db.select().from(plaidItemsTable).limit(1);
  return rows[0] ?? null;
}

// GET /plaid/status — honest connection state.
router.get("/plaid/status", async (_req, res) => {
  const plaid = getPlaidClient();
  if (!plaid) {
    res.json(PlaidStatusResponse.parse({ state: "not_configured" }));
    return;
  }

  const item = await getStoredItem();
  if (!item) {
    res.json(PlaidStatusResponse.parse({ state: "not_connected" }));
    return;
  }

  res.json(
    PlaidStatusResponse.parse({
      state: item.status === "error" ? "error" : "connected",
      institution: item.institution ?? null,
    }),
  );
});

// POST /plaid/link-token — create a short-lived link_token for Plaid Link.
router.post("/plaid/link-token", async (_req, res) => {
  const plaid = getPlaidClient();
  if (!plaid) {
    res
      .status(503)
      .json({ error: "not_configured", message: "Plaid is not configured." });
    return;
  }

  try {
    const response = await plaid.client.linkTokenCreate({
      user: { client_user_id: "trimly-local-user" },
      client_name: "Trimly",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    res.json(
      PlaidCreateLinkTokenResponse.parse({
        linkToken: response.data.link_token,
      }),
    );
  } catch (err) {
    logger.error({ err }, "Failed to create Plaid link token");
    res
      .status(502)
      .json({ error: "plaid_error", message: "Could not start bank linking." });
  }
});

// POST /plaid/exchange — swap the public_token for an access_token and store it.
router.post("/plaid/exchange", async (req, res) => {
  const plaid = getPlaidClient();
  if (!plaid) {
    res
      .status(503)
      .json({ error: "not_configured", message: "Plaid is not configured." });
    return;
  }

  const parsed = PlaidExchangeBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "bad_request", message: "publicToken is required." });
    return;
  }

  try {
    const exchange = await plaid.client.itemPublicTokenExchange({
      public_token: parsed.data.publicToken,
    });
    const accessToken = exchange.data.access_token;
    const itemId = exchange.data.item_id;

    // Best-effort institution name for display.
    let institution: string | null = null;
    try {
      const itemResponse = await plaid.client.itemGet({
        access_token: accessToken,
      });
      const institutionId = itemResponse.data.item.institution_id;
      if (institutionId) {
        const inst = await plaid.client.institutionsGetById({
          institution_id: institutionId,
          country_codes: [CountryCode.Us],
        });
        institution = inst.data.institution.name;
      }
    } catch (err) {
      logger.warn({ err }, "Could not resolve institution name");
    }

    // Single-item model: replace any existing connection.
    await db.delete(plaidItemsTable);
    await db.insert(plaidItemsTable).values({
      itemId,
      accessToken,
      institution,
      status: "active",
    });

    res.json(
      PlaidStatusResponse.parse({ state: "connected", institution }),
    );
  } catch (err) {
    logger.error({ err }, "Failed to exchange Plaid public token");
    res
      .status(502)
      .json({ error: "plaid_error", message: "Could not connect the bank." });
  }
});

// POST /plaid/sync — detect recurring charges and return suggestions.
router.post("/plaid/sync", async (_req, res) => {
  const plaid = getPlaidClient();
  if (!plaid) {
    res
      .status(503)
      .json({ error: "not_configured", message: "Plaid is not configured." });
    return;
  }

  const item = await getStoredItem();
  if (!item) {
    res
      .status(409)
      .json({ error: "not_connected", message: "No bank is connected." });
    return;
  }

  try {
    const response = await plaid.client.transactionsRecurringGet({
      access_token: item.accessToken,
    });
    const suggestions = streamsToSuggestions(
      response.data.outflow_streams,
    );
    res.json(PlaidSyncResponse.parse({ suggestions }));
  } catch (err) {
    logger.error({ err }, "Failed to sync recurring transactions");
    // Mark the connection as needing attention so status reflects reality.
    await db
      .update(plaidItemsTable)
      .set({ status: "error" })
      .where(eq(plaidItemsTable.id, item.id));
    res
      .status(502)
      .json({ error: "plaid_error", message: "Could not read transactions." });
  }
});

// DELETE /plaid/connection — remove the stored item and its access token.
router.delete("/plaid/connection", async (_req, res) => {
  const plaid = getPlaidClient();
  const item = await getStoredItem();

  if (plaid && item) {
    try {
      await plaid.client.itemRemove({ access_token: item.accessToken });
    } catch (err) {
      logger.warn({ err }, "Plaid itemRemove failed; removing local record anyway");
    }
  }

  await db.delete(plaidItemsTable);

  res.json(
    PlaidDisconnectResponse.parse({
      state: plaid ? "not_connected" : "not_configured",
    }),
  );
});

export default router;
