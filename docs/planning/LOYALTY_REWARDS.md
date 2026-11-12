# Rewards: wallet, points and "keep the change" (planned 2026-11-12, not built)

Plan only. Nothing is built. Builds on the customer store-credit ledger (migration 056), the customer segments and consent (123), billing and shift close.

## 1. Decisions (owner)
| # | Decision |
|---|---|
| 1 | Earn **1%** of what the customer pays. **Schedule H, H1 and X earn nothing.** |
| 2 | **1 point = Rs 1.** Minimum to redeem **50 points**; cap per bill **20% of the bill** (both adjustable in settings; owner took the suggested defaults, 2026-11-12). |
| 3 | Points **expire 12 months** after they are earned. |
| 4 | Change kept goes to the customer's **wallet** (rupees, no expiry), for change up to **Rs 10**. |
| 5 | Wallet and points are **usable at every store**. |
| 6 | Redeeming needs **the counter operator's confirmation** (no OTP). |

## 2. Two balances, shown as one
- **Wallet** (rupees): the existing store-credit ledger. Fed by returns refunded as credit and by change kept. Never expires. It is the customer's own money.
- **Points**: earned on purchases. Expire after 12 months, first earned used first.
- Everywhere (bill, profile, message) the customer sees one line: "Wallet Rs 47 | Points 340 (Rs 340)".

## 3. Earning
- Points = 1% of the amount the customer **pays in money or wallet** for **eligible lines**, after discounts. The part paid with points earns nothing.
- **Eligible line** = not Schedule H, H1 or X. (A bill with one H1 strip earns on the other lines only.) A setting lists the schedules that earn nothing (default H, H1, X) so the owner can change it.
- Earned when the bill is completed, whole points: the fraction is carried on the customer (Rs 355 earns 3.55; 3 points now, 0.55 carried), so nothing is lost to rounding.
- A bill for a customer with no mobile number earns nothing (no identity to credit).
- A **return** reverses the points earned on the returned lines. If those points were already spent the balance may go below zero and is made up from the next earnings.
- Credit sales (pay later): points are earned when the dues are paid, not when the bill is raised.

Worked example: bill Rs 347 (Rs 60 of it an H1 drug), paid Rs 347 cash. Eligible = 287, points = 2 (2.87; 0.87 carried).

## 4. Redeeming: how it works at the counter
1. At billing the operator picks the customer (mobile). A panel shows wallet, points, and **"Use up to Rs X"**.
2. X = the smallest of: the points held, the per-bill cap (**20% of the bill**, adjustable), and the bill total. Redeeming is only offered once the balance reaches the minimum (**50 points**).
3. The operator ticks **Use points** (the amount defaults to X and can be lowered, in whole rupees) and confirms. Points are used first (they expire), then the wallet if the customer wants it, then cash or digital for the rest.
4. Redeemed points are a **payment tender** on the bill: GST is on the full price, the bill shows "Paid with points Rs 80". They do not earn points.
5. Redemption applies to the whole bill including Schedule drugs (it is a payment, not a promotion).
6. Controls: the confirmation records the operator; the customer gets a message (with consent) "80 points used, balance 260"; the weekly review lists points redeemed per operator; a points balance cannot be redeemed for cash.
7. A **return of a bill paid with points** gives the points back (to a new lot that expires at the original date, or in 30 days if that has passed).
8. A bill can use the wallet with or without points. The wallet has no cap or minimum.

## 5. Keep the change (up to Rs 10)
- New till input: **Amount received** (cash). The change is received minus the bill total.
- If the change is Rs 10 or less and the customer is identified, the screen offers **"Keep the Rs 3 change in wallet"**. A per-customer default (always, ask, never) saves the question.
- Posting: wallet entry "Change kept", linked to the bill; the drawer receives the full amount tendered and gives no change, so the shift reconciles. Shift close shows "Change kept as wallet credit Rs xx".
- The bill prints "Rs 3 added to your wallet, balance Rs 47".
- It is the customer's money, so it never expires and is not converted to points.
- Accounting: an advance held for the customer (a liability), not a sale; confirm the GST and accounting treatment with the CA.
- Control: the weekly review shows change kept per operator, and the number of bills with change above Rs 10 not kept (to spot staff pocketing it).

## 6. Expiry
- Points live in **lots** (earned on a date, amount, remaining). Spending takes the oldest lot first. A lot expires 12 months after the earning date.
- A daily job expires lots, writes an "Expired" entry, and sends a reminder 30 days before (with consent) saying how many points expire on which date.
- The wallet never expires.

## 7. Data (sketch)
- `customer_points_lot` (customer, earned_on, expires_on, points, remaining, sale_id).
- `customer_points_entry` (customer, kind EARN / REDEEM / EXPIRE / REVERSE / RESTORE / ADJUST / BONUS, points, lot, sale, store, operator, note): the ledger; the balance is the sum.
- Wallet: the existing `customer_credit_entry` gets a kind `CHANGE` (positive).
- `sale`: points redeemed (amount) and the cash received and change kept.
- Settings under category `loyalty`: earn percent, schedules excluded, point value, minimum, cap percent, expiry months, change threshold, switch on or off.
- A module switch (loyalty) so a business can have it off.

## 8. Screens
- Billing: the customer panel line, the Use points control, Amount received and the keep-the-change toggle.
- Customer profile: a **Wallet and points** tab with one ledger and the expiry dates.
- Settings > Loyalty.
- Bill print and message: balance line.
- Reports: points outstanding (a liability), earned, redeemed, expired; change kept; redemptions by operator.

## 9. Build order
1. Ledger and rules (earn, reverse, redeem, expire) with unit specs.
2. Billing: the panel, redeem as a tender, amount received, keep the change, shift-close line.
3. Customer tab, bill print and message, settings.
4. Expiry job and reminder; reports and the weekly-review lines.
5. Tiers and bonuses (later, optional): spend-based tiers over a rolling 12 months, birthday, refill and referral bonuses.

## 10. Risks and to confirm
- GST and accounting for redeemed points and kept change (CA).
- Schedule drugs: no earning is the default; the owner and pharmacist confirm the rule.
- Consent for messages (the app already records it); a points statement is transactional, a promotion is not.
- Abuse: points redeemed by the wrong person without OTP; the operator confirmation, the message to the customer and the weekly review are the controls. OTP can be added later.
- The cap (20%) and minimum (50) are suggestions; at 1% earn, Rs 100 of points is Rs 10,000 of purchases.

## 11. Defaults taken (owner, 2026-11-12: "go with default")
- Minimum to redeem 50 points; cap 20% of the bill.
- Points cannot be redeemed when paying customer dues.
- No tiers at launch (spend-based tiers and bonuses stay in build step 5, later).
- Points before wallet; redemption applies to the whole bill including Schedule drugs; operator confirmation, no OTP (OTP can be added later).
- Redeemed points restored on a return keep their original expiry, or get 30 days if that has passed.

## 12. Still to confirm outside the app
- GST and accounting treatment of redeemed points and of change kept (the CA).
- The Schedule H, H1 and X rule (the pharmacist): no earning is the default.
