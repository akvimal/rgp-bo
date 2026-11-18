# Pricing area, and offers and sales (later)

Built 2026-11-18 (migration 226): the price pages moved out of Products into **Pricing**.

## What moved
| Was | Now |
|---|---|
| Products and prices > Price | **Pricing > Prices** `/secure/pricing/prices` (set prices, needs-a-price, bulk update, print the counter price list) |
| Products and prices > Pricing policy | **Pricing > Pricing policy** `/secure/pricing/policy` |
| Products and prices > Pricing rules | **Pricing > Pricing rules** `/secure/pricing/rules` |
| Price changes (own menu entry, `/secure/price-changes`) | **Pricing > Price changes** `/secure/pricing/changes` (the same sheet; its module is lazy-loaded inside Pricing) |
| Products and prices > Master, Pack check | **Products** (`/secure/products/master`, `/pack-check`); Pack check stays: it is a data check on the product record |

- Menu: Products and Pricing are separate entries (Inventory group; Counter and Sales Staff see Pricing in "Stock and buying").
- Old addresses redirect (`/secure/products/price|pricing-policy|pricing-rules|policy|rules`, `/secure/price-changes`), so alert links, the guide and sent links still work. Alert links now point at the new addresses.
- `/secure/pricing` opens the first page the role may see: Prices, or the changes sheet for a counter role.
- Permissions are unchanged: `products.price` for Prices, Policy and Rules; `pricechanges.view` for the changes sheet. A role's allowed pages are stored on the role, so migration 226 adds the new addresses to roles with those grants (`/secure/pricing/prices|policy|rules` on Products "price", `/secure/pricing/changes` on the sheet). The registry (`permission-registry.json`) lists them for new grants.
- The one-sentence "what the numbers are per" component moved to the shared module (it is on Products > Pack check and on three Pricing pages).

## Offers and sales (not built)
Today a product has one sale price, held to the pricing policy. Offers sit on top as time-boxed overrides and never rewrite that price.

- **Sale**: a markdown event. Scope (products, category, brand, near-expiry batches, stores), percent off or a price point, dates; reverts by itself.
- **Offer**: a rule-based deal: buy X get Y, bundle, spend over a threshold, payment-mode (UPI), customer segment or tier. This is where the loyalty and customer-segment plans plug in.
- **Guardrails**: never below the pricing policy floor or cost; approval through the existing path; a margin preview before it goes live; Schedule H, H1 and X drugs excluded by default (the owner can override).
- **Billing**: the best eligible offer per line, with stacking rules and a priority order; the offer is shown on the line and stored on the bill, so the weekly review can tell offer-driven discounts from manual ones.
- **Lifecycle**: draft, approved, live, ended; ending-soon and ended reminders via to-dos and alerts; Price changes lists offers started and ended; a results view of units and margin against the usual.
- **Order**: Sale (scoped percent-off with dates and auto-revert), then Offers (buy X get Y, bundle, threshold), then coupons, segment and payment-mode offers.
- **Permissions then**: split pricing into its own `pricing` permission with separate actions (prices, policy, rules, offers); offers need their own approval right.
