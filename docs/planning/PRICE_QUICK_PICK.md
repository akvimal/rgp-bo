# Quick price pick in the "Set the price" dialog (planned 2026-11-12, not built)

## Decisions (owner)
1. A **ladder** of discounts off the MRP in steps of x% (step 5: 0%, 5%, 10%, 15% ...), not rounding of the price itself.
2. The step is **one global setting**.
3. A **"Deepest allowed"** button gives the exact lowest price, even when it is not a round step.
4. The class limit is **hard for the helper only**: it never offers a price below the lowest price. Typing a lower price by hand works as today (approver, with a reason).

## Rules
- Lowest price = the existing `policy.lower` (class floor markup and discount cap; in Discount mode the minimum margin). No new margin setting.
- Rung price = MRP x (1 - k x step%), shown in the shop's price basis (with or without GST) using `priceWithGst` / `priceBeforeGst`. The stored price stays ex GST.
- A rung below the lowest price is greyed with the reason; the last allowed rung is followed by "Deepest allowed" (exact lowest price and its %).
- A rung that is a raise bigger than the step limit gets a warning note, not disabled (the live check already explains it).
- Picking only fills the Sale price box; nothing is saved. Typing clears the highlight. No MRP on record: the row is hidden.

## Screens
- Product "Set the price" dialog: a Quick pick row of buttons under the Sale price box.
- Invoice "new products need a price" rows, and the Needs a price table under Pricing policy: a compact dropdown with the same ladder.

## Settings (pricing mode screen, Business Head only)
- `quick_step_pct` (default 5), `quick_max_choices` (default 4, or until the class limit). Stored as `app_setting` keys beside `mode_*`; read with the mode settings the dialog already loads.

## Work
1. Settings keys + fields on the pricing mode screen (api-v2 `pricing-mode.ts`, validation, frontend form).
2. A pure ladder helper (MRP, tax, lowest price, step, basis) with unit specs beside the pricing specs.
3. Quick pick row in `product-price-change.component`.
4. Dropdown on the invoice new-price rows and the Needs a price table.
5. QA specs: ladder stops at the class limit; picking fills the box; rungs below the limit disabled; setting changes the ladder.

## Build status (2026-11-12)
Built, tested locally, committed. Settings `quick_step_pct` / `quick_max_choices` (pricing mode screen), ladder helper (api-v2 `quick-prices.ts` with specs, frontend copy `secured/products/quick-price.ts`), Quick pick row in the Set the price dialog, Quick pick dropdown on the invoice's new-product rows (the lowest price now comes with each row), QA specs QUICK-1..2.
Not built: a dropdown in the Needs a price table under Pricing policy (it only applies the suggested price, there is no typed price there).
