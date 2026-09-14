import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
// drizzle-zod v0.8 builds schemas with the Zod v4 API (exposed under `zod/v4`
// by the catalog's zod 3.25). Import from the same entry so inferred types line
// up with what createInsertSchema returns.
import { z } from "zod/v4";

// A connected Plaid Item (one row per linked institution). The access token is
// sensitive and lives only server-side; it is never sent to the browser.
//
// This is a single-user, local-first app today, so items are global to the
// instance. If multi-user support is ever added, this table gains a user_id.
export const plaidItemsTable = pgTable("plaid_items", {
  id: serial("id").primaryKey(),
  // Plaid's stable identifier for the linked item.
  itemId: text("item_id").notNull().unique(),
  // Long-lived Plaid access token used for server-side API calls. Sensitive.
  accessToken: text("access_token").notNull(),
  // Human-readable institution name for display (e.g. "Chase"). Optional.
  institution: text("institution"),
  // Connection health: 'active' when usable, 'error' when Plaid reports a
  // problem (e.g. credentials need re-authentication).
  status: text("status", { enum: ["active", "error"] })
    .notNull()
    .default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertPlaidItemSchema = createInsertSchema(plaidItemsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertPlaidItem = z.infer<typeof insertPlaidItemSchema>;
export type PlaidItem = typeof plaidItemsTable.$inferSelect;
