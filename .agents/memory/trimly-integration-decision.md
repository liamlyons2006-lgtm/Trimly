---
name: Trimly integration boundary
description: Why the first Trimly build keeps bank data and notification delivery out of the working client.
---

Trimly's first working path is intentionally manual-first: Plaid was offered but not authorized, so the app must not imply that bank transactions are imported. Bank linking and outbound reminders should be added only after the corresponding provider connections are authorized.

**Why:** Financial data and notifications are trust-sensitive; showing fake imports or pretending reminders were sent would undermine the product validation.

**How to apply:** Keep manual entry, local status tracking, and explicit connection states working independently. When adding Plaid or an email/push provider, wire real provider responses through the existing flows instead of replacing the manual fallback.