# Adjust stock: remove or add

Built 2026-11-09 (uncommitted). Screens: Stock > Products > batch > Adjust (`stock-adjust-form`), Stock > Adjust (`stock-adjust`); server `stock.service.ts`, `reason-codes.ts`. No migration.

## Problem
The Adjust form had one box labelled "Adjust" (plus adds, minus removes, said nowhere), bare numbers for Current and Final, and reasons that were nearly all losses (no way to say stock was found), so people used Correction or Other. The list showed the raw signed number.

## Now
1. **Say what is happening first:** two large buttons, *Remove stock* (red) and *Add stock* (green). Nothing else shows until one is chosen; Save says "Choose remove or add".
2. **How many units:** always a positive whole number; the effect is shown as `50 -> 45 units (removing 5)`; removing more than is in stock is said in words ("at most 50"). The quantity is sent signed.
3. **Why:** reasons depend on the direction.
   | Remove | Add |
   |---|---|
   | Damaged, Expired, Sent back to the vendor, Lost or missing, Correction, Other | Found in a count, Received but not entered, Returned by a customer (not through billing), Correction, Other |
   Switching direction clears a reason that does not belong. Other and Correction need a few words of comment.
4. **Review sentence** before saving ("You are removing 5 units of X (batch Y). Stock goes from 50 to 45. Reason: Damaged.") and a Save button that repeats it (*Remove 5 units* / *Add 5 units*). The audit-event link is under "More".
5. **List:** a Change column with `- 5 removed` (red) / `+ 3 added` (green), the reason in words, and "stock has not changed yet" under a pending one. The edit dialog uses the same remove/add choice; approving a count difference offers the reasons that fit a shortage or a surplus.
6. **Server:** a loss reason (Damaged, Expired, Returned to vendor, Shrinkage) with stock added, or a gain reason (Found, Not entered, Customer return) with stock removed, is refused with a plain sentence; applies when creating, editing the quantity or reason, and approving a count difference. Correction and Other go either way; system codes (transfer, audit) are untouched.

Stored codes are unchanged (older rows read as before); new codes `FOUND`, `NOT_ENTERED`, `CUSTOMER_RETURN` (fit the 20-character column). Shrinkage is shown as "Lost or missing".

## Checked
Unit tests: server rule (7), frontend helpers (6). Playwright `stock-adjust-direction.spec.ts` ADJD-1..3 (the server refusals and edits; the form with real clicks: nothing savable before choosing, effect in words, the quantity ceiling, reasons by direction, a comment for Other, signed saves; the list wording). Existing stock and audit specs pass; four (AUDIT-3, RF-2, ATRAIL-1/2) fail in the scratch database identically on the original code (the audit log reads empty there).

## Not done
- The form cannot tell, before saving, whether an adjustment will wait for approval (the server decides by value); it says a large one may, and the list shows it.
- Stock count and audit screens create differences through their own flow; their lists now read the same way only where they use this list.
