# Plaid Bank Connector — Spec (Sandbox first)

Status: **Draft for review** — no feature code written yet.

## 1. Goal

Let a Trimly user connect a bank through Plaid, have Trimly detect recurring
charges from their transactions, and turn those into Trimly subscriptions —
while never faking imported data. Built against **Plaid Sandbox** first, with a
clean switch to Production later.

## 2. Guardrails (from the project's recorded decision)

- Manual entry stays fully functional and independent. The connector augments
  it; it never replaces the manual fallback.
- Nothing in the UI may imply real bank data is present unless a real Plaid
  response produced it. Connection states are explicit: `not_connected`,
  `connecting`, `connected`, `error`.
- Detected charges are **suggestions**. The user confirms before anything
  becomes a subscription. Imported items are tagged `source: 'bank'`.
- Secrets (Plaid `client_secret`, `access_token`) live only server-side, never
  in the browser or `localStorage`.

## 3. Non-goals (for this phase)

- Plaid Production approval / real bank credentials.
- Automatic background syncing / webhooks (manual "Sync now" first; webhooks
  can come later).
- Outbound reminders (still out of scope per the existing boundary).

## 4. Architecture (fits the existing monorepo)

```
Browser (artifacts/trimly)                 Server (artifacts/api-server)         Plaid
──────────────────────────                 ─────────────────────────────         ─────
 Settings: "Connect bank"  ──POST /api/plaid/link-token──▶ create link_token ──▶ /link/token/create
 Plaid Link (react-plaid-link) opens
 user picks sandbox bank, gets public_token
 ──POST /api/plaid/exchange { public_token }─────────────▶ exchange + store  ──▶ /item/public_token/exchange
                                                            access_token in DB (encrypted)
 ──POST /api/plaid/sync────────────────────────────────▶ fetch recurring   ──▶ /transactions/recurring/get
                                                            map → suggestions
 ◀── suggestions[] ─────────────────────────────────────
 user confirms → existing addSubscription flow (source:'bank')
```

- **API contract**: added to `lib/api-spec/openapi.yaml`, then `orval` codegen
  regenerates the typed React Query hooks (`api-client-react`) and Zod schemas
  (`api-zod`). Frontend calls the generated hooks — no hand-written fetch.
- **Server**: new route module `artifacts/api-server/src/routes/plaid.ts`
  mounted under `/api`. Plaid SDK (`plaid` npm) wrapped in a small client in
  `src/lib/plaid.ts`. Config read from env.
- **DB**: new Drizzle table(s) in `lib/db/src/schema/` for stored Plaid items
  (one row per connected institution) holding the access token and item id.
  Transactions themselves are not persisted in this phase — we read recurring
  streams on demand.

## 5. Data model (Drizzle)

`plaid_items`
| column         | type        | notes                                  |
|----------------|-------------|----------------------------------------|
| id             | serial PK   |                                        |
| item_id        | text unique | Plaid item id                          |
| access_token   | text        | sensitive; server-only                 |
| institution    | text null   | display name                           |
| status         | text        | 'active' \| 'error'                    |
| created_at     | timestamptz | default now()                          |

Note: single-user local app today (no auth), so items are global to the
instance. If multi-user is ever added, this table gains a `user_id`.

## 6. API endpoints (OpenAPI)

| Method | Path                    | Body / Result                                   |
|--------|-------------------------|-------------------------------------------------|
| POST   | /api/plaid/link-token   | → `{ linkToken: string }`                       |
| POST   | /api/plaid/exchange     | `{ publicToken }` → `{ status, institution }`   |
| GET    | /api/plaid/status       | → `{ state, institution? }`                     |
| POST   | /api/plaid/sync         | → `{ suggestions: SubscriptionSuggestion[] }`   |
| DELETE | /api/plaid/connection   | disconnect / remove item → `{ status }`         |

`SubscriptionSuggestion` mirrors the fields Trimly needs (name, merchant,
amount, amountCurrency, billingCycle, nextChargeDate, category) plus a
`plaidStreamId` so re-syncs can dedupe.

## 7. Recurring detection & mapping

- Use Plaid `/transactions/recurring/get`, which returns inflow/outflow
  streams with `average_amount`, `frequency`, and `last_date`.
- Map frequency → Trimly `billingCycle` (WEEKLY→weekly, MONTHLY→monthly,
  ANNUALLY→annual; others flagged for manual review).
- `nextChargeDate` estimated from `last_date` + frequency, then run through the
  existing `rollForwardChargeDate` so it lands in the future.
- Dedupe against existing subscriptions by `plaidStreamId`, then by
  merchant+amount as a soft check, so re-syncing doesn't create duplicates.

## 8. Config (env vars)

Server reads:
- `PLAID_CLIENT_ID`
- `PLAID_SECRET`
- `PLAID_ENV` = `sandbox` (default) | `production`
- existing `DATABASE_URL`, `PORT`

If Plaid vars are missing, the endpoints return a clear `not_configured`
state and the UI shows "Connect bank" as unavailable — never a fake success.

## 9. What you (the human) need to provide

1. A free Plaid account → Sandbox `client_id` + `secret` (from the Plaid
   dashboard). I'll read them from env; you never paste them into code.
2. A Postgres `DATABASE_URL` (Replit provisions one; locally any Postgres).

Everything else I build and verify.

## 10. Build phases (incremental, each independently verifiable)

1. **DB schema** — `plaid_items` table + types; `db push`.
2. **Plaid client + config** — `src/lib/plaid.ts`, env validation.
3. **OpenAPI contract** — add paths/schemas; run orval codegen.
4. **Server routes** — link-token, exchange, status, sync, disconnect.
5. **Frontend connect flow** — Settings "Connect bank" via `react-plaid-link`
   + generated hooks; connection states.
6. **Suggestions review UI** — list detected recurring charges, confirm →
   `addSubscription({ source: 'bank' })`.
7. **Tests** — mapping logic (frequency→cycle, next-date, dedupe) unit-tested.

## 11. Open questions for you

- **Q1.** Confirm sandbox-only for now (I'll structure for an easy prod switch).
- **Q2.** Can you provide Sandbox keys + a `DATABASE_URL`, or should I stop at
  the point where the app runs but reports `not_configured` until you add them?
- **Q3.** OK to add `plaid` (server) and `react-plaid-link` (frontend) deps?
- **Q4.** Confirm imported subscriptions should be editable/deletable like any
  other (they will be, just tagged `source: 'bank'`).
