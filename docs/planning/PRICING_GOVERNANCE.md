# Pricing governance

Status: study done 2026-10-24 (read-only, on the local copy of production data). Phase 2 built (pack-size check, receiving unit check, MRP ceiling fix). Phase 3 built (price policy, review queue, stepped raises, approvals). Phase 4 built (GST-billed basis, billing guard, alert, GMROI, impact).
Study script: `scripts/pricing-study.py`. Its CSV output holds business margins and lives outside the repo
(`D:\workspace\rgp-migration\pricing-study\`).

## Decisions (2026-10-24)

| # | Decision |
|---|---|
| 1 | Keep **markup on cost** as the working convention (also show gross margin). |
| 2 | Customers must not see **sudden increases**: a price rise is stepped, a cut is immediate. |
| 3 | The study runs on production data (the local copy `rgp_rehearsal2`, 61,846 completed sales, Feb 2022 to Oct 2026). |
| 4 | **Store Head** approves price changes up to a threshold; above it, **Business Head**. |

## How the study measured things

- Window: 20 Oct 2025 to 20 Oct 2026, completed sales, ex-GST. Revenue reconciles to bill totals (30.71 lakh x 1.05 = 32.2 lakh vs 32.29 lakh billed; no bill-level discounts exist).
- Sale price is per unit and excludes GST; purchase rate is per pack and excludes GST; MRP includes GST.
  Unit cost = `ptr_value x (1 - disc%) x qty / (qty + free_qty) / pack`, taken from the batch each sale line is linked to.
- Discount off MRP = `1 - price x (1 + GST) / MRP`.

## Findings

1. **The business earns 53.6% gross margin (115% markup)**, steady at 53 to 55% every month. One month (Mar 2026, 46%) is a data error, see 6.
2. **The money is in high trade-margin products.** Products whose cost is 70%+ below MRP are 625 products, 69% of revenue and **83% of gross profit**, sold at an average 51% off MRP (markup 180%). Products with under 30% trade margin (branded, 392 products) are 11% of revenue and **under 1% of profit**.
3. **162 products earn 70% of the profit** (average discount 49%, markup 151%). 849 products earn the last 10% (discount 18%, markup 57%).
4. **Discounts are deep, and markup stays high even at the deepest bands.** 36% of revenue sells at 50% off MRP or more; 9% at 70%+ off, still at 156% markup. Only 7% of revenue sells at MRP.
5. **Deeper discounts do not buy much volume.** Across 207 price cuts of over 20%, units sold in the next 60 days were a median 1.06x the previous 60 days. Across 260 raises of over 20%, a median 0.93x; only 8 products stopped selling. Demand is not very price-sensitive at these levels (confounded by stock-outs and season, so treat as direction, not precision).
6. **Pack-size data errors distort cost.** Almost all "sold below cost" lines (164 lines, 17 products, loss 39k) come from two products: gloves costed at 220 per unit and insulin syringes (pack set wrongly). The Mar 2026 dip is the same gloves line (-18.9k).
7. **Cost rises are not passed on.** 58 products had unit cost up over 5% (average +13.9%) while price moved -1.3%; only 13 followed. Lost margin about 11k per half year today, concentrated in high-volume generics (Telmavas AM, Glimp 1mg, Nivabion Forte, Nebimax). Small in rupees now; it grows with every price round.
8. **Prices swing a lot.** In 12 months 2,148 price changes on 1,001 of the 1,263 products sold (97% logged as "Purchase"); 366 were raises of over 20%, 343 cuts of over 20%. Customers see large jumps already; repricing is frequent but not rule-based.
9. **Vendor price creep is modest.** On repeat purchases, 12% (Karthikeyan), 21% (Palepu), 23% (JL City) and 4% (Seyon) of lines rose, 7 to 14% rose over 5%. Extra paid about 10k in the year. The Phase A check will catch these as they happen.
10. **Classification by flag does not work.** Only 712 of 1,963 active products are flagged generic, 68 not generic, 1,183 unset. Class must come from data (trade margin and profit rank), not the flag.

### What a discount cap would be worth (12 months, ex-GST, upper bound)

Lines sold deeper than the cap are repriced to the cap; "kept" is the share of those units still sold.

| Cap off MRP | Lines / products | GP change, all kept | 90% kept | 80% kept |
|---|---|---|---|---|
| 70% | 3,236 / 76 | +1.59 lakh | +1.26 lakh | +0.93 lakh |
| 60% | 8,367 / 147 | +3.52 lakh | +2.79 lakh | +2.05 lakh |
| 50% | 13,589 / 260 | +6.48 lakh | +5.17 lakh | +3.85 lakh |

Total gross profit is 16.5 lakh, so a 60% cap is worth up to about 21%. These are upper bounds: moving a product from 70% to 60% off is a 33% price rise for the customer, which decision 2 says must be stepped, not done at once.

## Policy design

**Classes (from data, reviewed monthly):**
- By trade margin (MRP vs cost): under 30%, 30 to 70%, 70%+.
- By profit rank: A (first 70% of profit), B (next 20%), C (last 10%).
- Special: chronic monthly medicines, near-expiry, scheduled drugs.

**Per class:** target markup, floor markup, maximum discount off MRP, reprice mode.

**Price rule:** `price = higher of (cost x (1 + floor markup)) and (MRP x (1 - class discount))`, never above MRP, never above the discount cap. The floor wins.

**Reprice modes:** keep discount (price follows MRP), keep markup (price follows cost, capped at MRP), MRP only.

**Stepping (decision 2):** a proposed raise is applied in steps. Default: at most 10% of the current price, or 5 points of MRP, per step, one step per product per 2 weeks. A cut applies immediately. The review queue shows the current price, the target and the steps to get there.

**Review queue:** triggered at receiving (a new batch with a cost or MRP change) and by a monthly scan. Lists products whose markup is below floor or whose price is out of policy, with a proposed next step and one-click accept.

**Approval (decision 4), defaults to confirm:**
- Store Head: a change inside policy (markup at or above floor, discount within class cap) that moves the price by at most 15%, on a B or C product.
- Business Head: any A product, any change over 15%, a price below floor, a discount above the class cap, or an exception to the stepping rule.
- Every change keeps who proposed, who approved, the reason, and before/after markup.

**Data hygiene:** a pack-size check at product setup and receiving (cost per unit against MRP per unit; flag a cost above MRP or a trade margin outside 0 to 90%).

**Counter discipline:** a cap on manual bill discounts per role, so the policy is not undone at the till.

## Phases

| Phase | Scope |
|---|---|
| 1 | Pricing study (done) and a monthly report of the same tables in the app (markup/discount by class, drift, below floor) |
| 2 | Pack-size sanity check and clean-up of the products it finds |
| 3 | Classes and policy fields, stepped-price calculation, price review queue, approval matrix |
| 4 | Weekly exceptions digest through the notifications engine; GMROI; price-change impact tracking |

## Open points

- Starting values: floor markup and discount cap per class (to set from findings 2 to 4; suggest starting with caps of 80% to 70% on the deepest products, stepping down over 2 to 3 months).
- Approval threshold: 15% and class A/B/C split above are proposed defaults.
- The volume response (finding 5) should be re-measured after the first stepped changes, since that is a cleaner test.

## Phase 2 as built (2026-10-24, uncommitted)

Defaults accepted: Store Head up to 15% on B/C products, A products and larger moves to Business Head, raises stepped (10% of price or 5 points of MRP, one step per product per 2 weeks), discount caps stepping down from 80% towards 70%.

Units (verified on production data): the list price (`product_price2.sale_price`) is **per pack and excludes GST**; the bill adds GST on top (`sale_item.price` is per unit = list / pack, `total = price x qty x (1 + GST)`); MRP and purchase `ptr_cost` include GST; `ptr_value` excludes it.

- **MRP ceiling bug found and fixed.** The price cap compared the ex-GST price with the GST-inclusive MRP, so a price at the MRP was billed at MRP plus GST. In the last 12 months 846 sale lines (127 products, 2.2% of lines, about 3,300 rupees over) were billed above the printed MRP, almost always by exactly the GST rate; the trend falls from about 400 lines a month to about 40 since Nov 2025. Now the API caps a price at `MRP / (1 + GST)`, margin is measured against the ex-GST cost, and `price_view` (migration 094) and the price screens use the same like-for-like arithmetic (they previously understated discount and margin by roughly the GST).
- **Still open:** 139 products currently have a list price whose GST-inclusive amount is above the MRP (shown in the Data check); the POS does not clamp a bill line to the MRP, so a stale list price can still overcharge. Fix the lists first (Data check), then add a billing guard.
- **Pack check** (`GET /products/pack-check`, Products > Data check): unit jump (MRP differs 2.5x or more between two purchases), cost above MRP, price above MRP, price under 5% of MRP. 23 unit-jump products on production data, including the two that faked the "sold below cost" lines.
- **Receiving:** a line whose MRP is 2.5x (or a tenth of) the product's last purchase needs the reason **Unit / pack changed** (migration 093) and shows a link to check the product's pack.

## Phase 3 as built (2026-10-24, uncommitted)

**Rules** (`products/price-policy.ts`, pure and unit-tested, 21 tests): a product's class is its trade margin band (LOW under 30%, MID 30 to 70%, HIGH 70%+, from the latest cost against the MRP) and its profit rank (A first 70% of 12-month profit, B next 20%, C the rest and products with no sales). Each of the 9 classes has a floor markup and a discount cap (`price_policy`, migration 095). A price must sit between `max(cost x (1 + floor), MRP x (1 - cap) / (1 + GST))` and the legal ceiling `MRP / (1 + GST)`.

**Starting values**, chosen by running candidate sets over the production copy (1,747 priced products): floors HIGH 60% / MID 25% / LOW 8%; caps HIGH 80% / MID 60% / LOW 20% (same for A, B, C until a reason to differ). On production data this puts about 266 prices above the legal ceiling (to be cut), 47 below floor or over cap (to be raised in steps, median rise 7%, 90th percentile 39%), and holds 23 pack suspects for checking. Lowering a cap later (80 towards 70) simply feeds the same queue, so the move is stepped automatically.

**Live review queue** (`GET /pricing/review`, Products > Pricing policy): computed on request from current prices and the latest completed purchase, so a cost or MRP change shows at once. Items carry this step's price, the target, the held-until date and who may apply it. A raise is at most a tenth of the price or 5% of the GST-free MRP, once every 14 days; a cut to the legal ceiling is immediate. `POST /pricing/apply` applies one step, `POST /pricing/apply-cuts` all legal cuts.

**Every price change is checked** (`addPrice`, and an edit of the price in force): a change that ends below the floor or over the cap, or a raise bigger than a step or within 14 days of the last change, needs an approver and a reason (`overridereason`, stored on the price row and audited as `price.policy_override`). Approval: a Store Head can approve step-size and timing breaks on class B/C within 15%; a Business Head (or Owner-operator) approves everything else (class A, below floor or over cap, larger than 15%). Anyone else is refused (403). The first price of a product is checked against the bounds only. Products with no completed purchase have nothing to check.

**Exceptions** (`price_exception`): the Business Head accepts one product's out-of-policy price until a date; it leaves the queue. Class table edits are Business Head only and audited.

**QA:** the seed and the price specs now pass `overridereason`; new `qa/specs/price-policy.spec.ts` (POLICY-1..4). Run against a local API on the dev database: the 8 API specs pass; the QA suite as a whole and the UI specs were not run.

**Not built (Phase 4):** weekly exceptions digest, GMROI, price-change impact tracking, a billing guard against lines above MRP, and a count badge in the menu.

## Phase 4 as built (2026-10-24, uncommitted)

**GST billed at the till is one rule** (migration 096). Since GST 2.0 (22 Sep 2025) the till bills at most 5% on every line, whatever the purchase batch says (`sale.helper.ts`). Since Nov 2025, 37,105 lines billed at 5%; about 3,300 of them came from batches tagged 12% or 18%. `public.sale_gst(tax)` (cap in `app_setting pricing/sale_gst_cap_pct`, default 5) is now the GST used for the legal ceiling, the discount off MRP, the pack check and the policy subjects; the batch's own GST is used only on the cost side. `price_view` gains `sale_tax`. This replaces the Phase 2 ceiling, which used the batch GST and was stricter than the bill needs (it showed 266 prices to cut; on the same data it is now 114).

**Billing guard** (migration 097, `sales/mrp-guard.ts`): a completed bill is refused if any line's `price x (1 + GST)` per unit is above the batch's MRP per unit (server derives the MRP from the purchase item). The till already lowers the price itself: `GET /stock/filter` rows carry `price_ceiling` (per unit, before GST), sent even to counter staff who are not shown the MRP, and `sale.helper.ts` caps the line at it. Kill switch: `app_setting pricing/sale_mrp_guard` = `off`.

**Alert** `price_policy` (default rule for every business): three standing notifications kept current by the alerts engine, in English and Tamil: prices above the legal ceiling (critical), prices out of policy with how many are held, and products whose pack or cost looks wrong. They link to Products > Pricing policy / Data check. This is the weekly exceptions digest, as an alert that clears itself when the queue is empty (the daily digest deliberately carries no margin figures).

**GMROI and price-change impact** (Products > Pricing policy; `GET /pricing/performance`, `/pricing/impact`).

First read on the production copy (12 months, stock at cost now, negative balances counted as none):
- Overall gross profit 16.3 lakh on 2.57 lakh of stock: GMROI 6.35.
- HIGH_A: 137 products, 64% of profit, GMROI 15.9. All C classes together: 1,340 products holding about half the stock (1.3 lakh) at GMROI between 0.6 and 1.2.
- Queue on the same data: 114 prices above the legal ceiling, 49 below floor or over the cap, 27 to check.
- Price changes (28 days before and after, 194 changes, 49 with enough sales): raises median -4% units (27), cuts median +40% (22); cuts of 10% or more +78% (16). This is a short, noisy window and is **not** the same as the earlier study (207 cuts of over 20%, median +6% over 60 days). Treat the volume response as undecided until more stepped changes are measured.

**Seen while doing this, for your accountant:** the till bills 5% on every line, including the roughly 245 lines since Nov 2025 from batches tagged 18%. If any of those products (for example cosmetics or non-medicine items) stayed at 18% after GST 2.0, GST is being under-collected. Not changed here.

**QA:** `qa/scripts/bootstrap-db.sh` now lists migrations 091 to 097 and switches the guard off (the suite's sample bills use prices far above the sample MRPs); POLICY-5 turns it on for its own check and back off. API specs POLICY-1..5 and PRICE-1..4 pass against a local API on the dev database. The full suite was not completed (the UI specs cannot run against a local API with other tokens).
