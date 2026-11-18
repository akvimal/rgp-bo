# Vault count after the day closes

Built 2026-11-18 (migration 227). Decided with the owner: do it or give a reason; the closing cashier may also count; a difference from the books needs a reason.

## The rule
- When a store that keeps a vault ends its day (a shift closed as **end of day**, and no other shift of that date still open), a vault count is owed. A handover is not the end of the day.
- It is a compliance register item, `vault_count` (cash class, owned by the Store Head). Due on the day, Late the next day (the Store Head is told), escalated by the business's escalation days. A waiver (holiday, closure) lifts it.
- **Do this to continue:** opening the next shift is refused ("Count the vault after the day closes") until it is counted, or the person types a reason, which is recorded and shown to the Store Head. Defaults: late after 1 day, required after 1 day (both are compliance settings: `vault_count_late_days`, `vault_count_required_days`; 0 makes it required the same day).
- Only the last two days are owed, so a deploy does not list history. Stores without a vault owe nothing.
- Settled by order, not by clock: a count records the last end-of-day shift that had closed when it was made (`store_vault_counts.after_shift_id`), and a day is settled when a count came after its last end-of-day shift. A count made before the day's last close does not settle it. No time zone comes into it.

## Who counts
- A Store Head or Business Head, as before, or **the person who closed the store's day** (the shift's closer, closing operator or assigned person) within the last two days. Anyone else at the store is told who counts. The vault page and its balance stay manager-only; `GET /store-vault/:storeid/count-due` is open to anyone at the store and says whether a count is owed and whether the caller may do it.
- On My shift a **Count the vault** box appears while a count is owed: the notes and coins are counted by face value; if the total differs from the books the person is asked why before it saves.

## The reason
- Any difference (a paisa or more, as at a shift close) needs a reason of at least 3 characters (`store_vault_counts.variance_reason`). The API answers 400 with `needsreason` and the variance. The reason shows on the vault page under the last count, and is in the audit entry.

## Not built
- The end-of-day Telegram summary does not yet say that the vault is uncounted.
- A rollout day: stores whose day closed in the last two days before deploy owe one count.

Tests: `qa/specs/vault-count.spec.ts` (VCNT-1..4), `vault-count-due.spec.ts`, `compliance-rules.spec.ts`.
