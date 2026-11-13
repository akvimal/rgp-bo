# Customer households: one mobile, one account, many people (planned 2026-11-13, not built; live count done, go-ahead recommended)

Plan only. Step 0 is a read-only count on the live database; nothing else starts until its answer is seen.

## Status
- **Step 1 built 2026-11-13 (migration 193), uncommitted.** `household` and `household_mobile_history` tables; `customer.household_id`, `relationship`, `dob`; a database trigger that puts every new or changed customer in the household of its mobile (so screens, imports and scripts all stay consistent); a backfill (one household per number, one per no-mobile customer). Tested on a scratch copy of the dev database: backfill count equals distinct numbers plus no-mobile customers, re-running is harmless, a new person joins the shared number, a lone person's number change moves the household and keeps the old number in the history, one of several moves to the household of the new number, two writers on one new number end in one household.
- Also in step 1: the duplicates screen hides different-name numbers (families) unless asked; a merge of clearly different names needs "they are the same person" confirmed (server and screen); the customer page lists "Also on this number".
- **Step 2 built 2026-11-13 (uncommitted):** at the till, once a customer with a full mobile is on the bill, a strip shows **Who is this for?** with each person on the number (name, relationship) and **+ Someone else on this number**. Choosing another person changes only who the bill is for (nothing of the previous person is saved onto them); adding someone keeps the number, takes a name and an optional relationship, and saves them into the same household. The customer form has a "Related to others on this number" choice (self, spouse, child, parent, other; checked on the server). A masked number cannot be added to, so the add link only appears for a number shown in full. Not tried in a browser.
- **Step 3 built 2026-11-13 (migration 194, uncommitted):** consent, do-not-contact, channel, language and the review opt-out are one answer per number. The household holds them and the customer columns stay as mirrors kept equal by triggers, so every reader and writer works unchanged: a change to anyone's answer is copied to everyone on the number (including a WhatsApp STOP, which updates one customer); a new person on an existing number takes the household's answers; a person who moves to another number takes that household's; the first person of a new number sets them. Backfill: the safe answer wins (anyone asked not to be contacted means the household has), consent, channel and language from the most recent answer; the households whose people disagreed are reported as a NOTICE. Messages go once per number: the audiences and the daily worklist list people who share a mobile once ("also on this number: ..."), the reachable counts count numbers, "recently contacted" and the review-invitation guard look at the whole household. Tested on a scratch copy of the dev database (backfill with disagreement, every trigger case, no loops); API tests and the AOT build pass; not tried in a browser. The "settle disagreements" screen is not needed: the safe answer settles them and the count is reported.
- **Step 4 built 2026-11-13 (migration 195, uncommitted):** store credit, dues and the pay-later limit are the household's. Ledger rows carry `household_id` (stamped by trigger); balances, the till's checks, collect, the dues list, the worklist/audience credit and dues read by household; the limit lives on `household.credit_limit` (the customer column is kept equal). API tests pass; migration 195 and the changed queries NOT yet run against a scratch database, not tried in a browser. Not yet repointed: review and insights aggregates (still per person).

- **Step 5 built 2026-11-13 (uncommitted, no new migration):** `customer-household.service.ts` + customer page 'Account' links. Change the household number once for everyone (clash with another account refused, old number to the history, consent asked again, do-not-contact kept; search finds the old number); give one person their own account (own number or location, limit 0, consent cleared, balances stay behind); join two accounts (Business Head; people, history, dues, credit and limit move; safe contact answer wins); move dues or store credit between accounts (Store Head; pair of adjustment entries with a reason). Migrations 193-195 and every one of these statements were run on a scratch copy of the dev database (rolled back): correct. API tests and AOT type-check pass; not tried in a browser; the service itself is not covered by a test against a database.
- **Step 6 built 2026-11-13, in part (migration 196, uncommitted):** the per-person `customer.credit_limit` is dropped (nothing reads it; the limit is the household's); rollback re-adds it from the household. Run on the scratch database, with the rollback and a re-run. **Deliberately kept:** `customer.mobile` and the contact answers (consent, do-not-contact, channel, language, review opt-out): bills, WhatsApp, worklists, refills and imports still read them (4 to 7 API files each, and the mobile far more), and the triggers keep them equal to the household's. Dropping them is a large change for no gain; do it only if a reader is ever moved to the household.
- **Browser-checked 2026-11-13** against the scratch database (API on rgp_hh_test, Angular dev server, Playwright Chromium): `qa/specs/household-accounts.spec.ts` (new, 2 tests) drives the Account links: change number (everyone follows, old number kept and searchable), give own account (balance stays with the family), refused move with the reason shown, move a balance, join two accounts. Passes. The existing customer, customer-history, pos-save-customer and store-credit specs: 28 of 30 pass; the 2 failures are not from this work (CUST-14 expects a mobile-required message that the earlier no-mobile feature removed; CUSTH-4 needs document categories the scratch data lacks). Note: the scratch copy of the dev database lacked migrations 175-192; they were applied there to run the sale specs.
- Plan complete (steps 1 to 6). The settle-the-disagreements list is deferred to step 3 (no disagreements exist today).

## 1. The problem
A customer is identified by **name plus mobile together** (`customer_un` on `(name, mobile)`). The same mobile with a different name is allowed, so every family member is a separate customer with no link between them. 17 tables hang off `customer_id`: store credit, dues, contact log, consent and do-not-contact, refill and prescription follow-ups, documents, grievances, messages, review invitations and more.

What that costs:
- **Fragmented money.** A husband's and a wife's dues and store credit are separate balances, though the family treats them as one account.
- **Contradictory contact answers.** Do-not-contact, consent, channel and language can differ between names on the same phone number.
- **Wrong greeting.** A WhatsApp bill to a shared number is addressed to whichever name was billed.
- **Merging real people.** The duplicates screen lists numbers held by more than one customer as "most likely duplicates", and the merge folds their bills, documents and refill notes together. Merging a husband and wife loses who needed which medicine.

## 2. Decisions (owner, 2026-11-13)
1. **Build it as a household layer**, not a rewrite: the existing customer row stays and becomes the **person** (patient or buyer); a new **household** owns the mobile and the account-level things.
2. **The balance is household-level.** Store credit, dues (pay later) and the credit limit belong to the household. Each ledger row still says which person it came from.
3. Measure first (section 3), and decide how much to build from the answer.

## 3. Step 0: measure (read-only, run on the VPS)
`scripts/household-count.sh` (SQL in `scripts/household-count.sql`): one read-only transaction of SELECTs, counts only, no name or full number printed.

```bash
bash scripts/household-count.sh                  # counts
DETAIL=1 bash scripts/household-count.sh         # plus the 15 most shared numbers, last 4 digits only
# another database: PSQL="docker exec -i <db container> psql -U <user> -d <db>" bash scripts/household-count.sh
```
It reports: live customers; numbers held by more than one customer (with how many have 2, 3, 4, 5 or more); the share of the last 12 months' bills and value those customers carry; dues and store credit sitting on more than one person of the same number; numbers whose people disagree on do-not-contact, channel, language or consent; a rough family-versus-same-person-twice split (first names on a shared number); alternate mobiles that are another customer's mobile; refill follow-ups on shared numbers.

**How to read it**
- A handful of shared numbers (say under 2% of numbers, under 3% of bills): do the light fix only (step 1 below plus the merge-tool change in step 5) and stop.
- A real share, or any dues or credit split across people of one number: go ahead with the plan.
- Many "same person twice" results: tidy those first with the existing merge tool, then re-count.
(Tested on the local dev copy, with a synthetic shared number; not yet run on the VPS.)

### Result on the live database (2026-11-13)
| Measure | Result |
|---|---|
| Live customers | 3,372 (3,103 with a mobile, 268 with none, 1 walk-in) |
| Distinct numbers / shared by more than one customer | 2,977 / **102 (3.4%)**, holding 228 customers |
| People on a shared number | 86 numbers with 2, 12 with 3, 1 with 4, 3 with 5 or more (most: 6) |
| Bills last 12 months on shared numbers | **773 of 14,720 (5.3%), 17.4% of the value** |
| Dues or store credit on shared numbers | **0** (nothing held yet) |
| Contact answers that disagree (do-not-contact, channel, language, consent) | **0** |
| Family or same person twice (rough guess) | 78 likely family, **24 likely the same person entered twice** |
| Alternate mobile that is another customer's mobile / refill follow-ups on shared numbers | 0 / 0 |

**Reading it**
- Above the "light fix only" line (3.4% of numbers, 5.3% of bills) and, more telling, shared-number customers carry **17.4% of the value**: families are the better customers. So the household layer is worth building.
- The costs it was meant to remove (split balances, conflicting consent) are **not there yet**, because dues, store credit and consent are new and unused. That makes the household balance cheapest **now**: there is nothing to backfill, and nothing to untangle later.
- About a quarter of the shared numbers (24 of 102) look like one person entered twice: tidy those with the merge tool first, one by one, before the household backfill so a duplicate does not become a "family member".
- The 4 numbers with 5 or more people are probably not families (a shop, hostel or agent's phone). Run `DETAIL=1` to see them (last 4 digits only) and decide whether they become households or stay as they are.
- 268 customers have no mobile (8%): they become households by name plus locality; how many share name and locality was not measured.

**Decision:** go ahead with steps 1 to 5, in order, each shipping on its own. Do the household balance (step 4) before pay later, store credit or loyalty see real use.

## 4. The model
```
household (id, business_id, mobile null, locality, consent..., do_not_contact, preferred_channel, message_language, review_optout, credit_limit, notes, audit columns)
household_mobile_history (id, household_id, mobile, from_on, to_on, changed_by)
customer (existing)  + household_id, relationship (self, spouse, child, parent, other; optional), dob (optional)
```
- A **household** with no mobile is identified by name plus locality, as the no-mobile customers are today.
- `customer.mobile` and the account-level columns on `customer` stay as **mirrors** of the household, written only by the household service. Existing readers (WhatsApp, refills, worklists, segments) keep working untouched; only the writers change. The mirrors are removed in a later cleanup when every reader uses the household.
- **Backfill:** one household per distinct mobile (and per name-plus-locality for no-mobile customers); `household_id` set on every customer; consent, do-not-contact, channel, language and credit limit taken from the most recently active member, with disagreements listed for a person to settle. No bill, no foreign key and no balance moves.

## 5. Money at household level
- `customer_credit_entry` and `customer_due_entry` get `household_id` (stamped when the row is written; backfilled from the customer's household). **The balance is the sum by household.** `customer_id` on the row still says who bought or returned.
- The pay-later **credit limit** and the overdue test read the household total, so a family cannot take a limit each.
- Changes: `store-credit-rule.ts` (`creditBalance`), `customer-credit.service.ts`, `customer-due-rule.ts` and `customer-due.service.ts`, the relationship worklists and segments that show balances, the POS payment box (balances are those of the household), and the planned loyalty wallet (built household-level from the start).
- Customer commitments (advance for an order) stay with the commitment and the person it was taken for; their settlement is unchanged.

## 6. Flows
- **POS.** Typing a mobile shows the household's people: **Who is this for?**, and **Add a family member** (same mobile, new name, new person in the same household). The duplicate-name warning becomes this explicit step. A bill saves the person; the household follows from it. Scheduled drugs keep asking for the patient and prescriber on the bill.
- **A patient wants their own account (detach).** The person is moved to a new household with their own mobile (or the no-mobile route). Their bills, documents and refills stay with them. **Balances stay with the household they arose in**; the detached person starts at zero; a Store Head can transfer an amount explicitly (a pair of adjustment entries, one to each household, with a reason). Consent for the new number is captured fresh.
- **The mobile changes.** Changed once on the household; every person follows in one transaction (the mirrors are updated with it). The new number is checked against other households (a clash asks for a merge decision, never a silent overwrite); the old number goes into `household_mobile_history` so searching it still finds the household; **consent is per number**, so consent for the old number is not assumed for the new one until it is captured; audit-logged.
- **Merge.** Restricted to genuine duplicates of one person. "Same mobile, different name" is no longer listed as a duplicate. Merging two households is its own action (both numbers kept in the history).
- **Messages.** One message per household for a shared number, addressed to the household or the person billed. **Refill reminders name the medicine, not the patient**, by default, so a family member's treatment is not revealed to the rest of the family; patient notes are staff-only.

## 7. Build order
0. **Measure** (section 3). Decide.
1. **Households, no visible change.** Tables, backfill, the household service with the mirrors, the settle-the-disagreements list. Merge-tool guard: stop proposing same-number-different-name as a duplicate.
2. **POS "who is this for" and add a family member**; customer screen shows the household and its people.
3. **Household-level contact answers** (consent, do-not-contact, channel, language) read from the household; one message per household.
4. **Household balance**: credit, dues and the limit (section 5); the ledger `household_id`, the readers above, tests with two people of one household.
5. **Detach, change mobile, merge households**, transfer of a balance, the mobile history.
6. Cleanup: drop the mirrors once nothing reads them.
Each step ships on its own and can be left there.

## 8. Specs to add
Backfill (shared numbers, no-mobile, Nil walk-in untouched); household service (add person, mirror kept in step, mobile change with a clash, history, consent not carried); balances (two people, one household: credit used by the other person, the limit across both, a void putting it back); detach (bills stay, balances stay, transfer entries); the duplicates list and merge guard; POS flow; a message sent once per household.

## 9. Risks
- Many readers use `customer.mobile` and the account columns: the mirrors keep them working, but a missed writer would let a mirror drift. One service writes them, and a check (a test and a scheduled query) compares mirrors to households.
- Balances move to a new key: backfill is checked by comparing every customer's old balance with their household's total, before and after.
- Staff habit: the "who is this for" step adds a tap at the till for shared numbers only; a number with one person goes straight through.
- Privacy (DPDP): people in a household can be seen by staff only; reveals stay logged as today; messages never name a patient's medicine to the household without the owner's choice.

## 10. Open points
- The 24 numbers that look like one person entered twice (clean up first) and the 4 numbers with 5 or more people (not families?).
- Whether date of birth and relationship are wanted now or later (planned optional; useful for age-based advice and refills).
- Whether a business ever wants separate credit limits inside one household (assumed no).
- The CA or lawyer's view on consent per number and on messaging a shared number.
