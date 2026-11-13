# Customer households: one mobile, one account, many people (planned 2026-11-13, not built)

Plan only. Step 0 is a read-only count on the live database; nothing else starts until its answer is seen.

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
- The live count (step 0) and the real share of "same person twice".
- Whether date of birth and relationship are wanted now or later (planned optional; useful for age-based advice and refills).
- Whether a business ever wants separate credit limits inside one household (assumed no).
- The CA or lawyer's view on consent per number and on messaging a shared number.
