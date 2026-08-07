# RGP Back Office - UI/UX Consistency & Interface Enhancement Backlog

**Date:** 2026-08-06
**Branch:** feature/shift-cash-phase1
**Status:** Backlog — not started
**Source:** Full interface audit (82 templates, all 8 modules + shell), plus two functional bugs surfaced while fixing the Site Admin login-landing and Settings-menu-logout issues this session.

---

## Executive Summary

The app is structurally consistent where it matters most — routing, permission gating, and the module shell pattern repeat cleanly across Products, Sales, Purchases, and Store. What's missing is finish: there's no considered visual identity (the CSS is still the unmodified vendor demo theme), no shared way of formatting money or dates despite this being an INR pharmacy ledger, and almost no user feedback when something is loading, empty, or has failed. None of this requires restructuring anything — it's a formatting layer, a small shared badge component, and a copy pass. Two items below are outright bugs (not just inconsistency) and should be treated with more urgency than the rest.

---

## Known Bugs Carried Over From This Session (not yet fixed)

These came up while fixing the Site Admin login-landing bug and the Settings-menu-logout bug (both already fixed on this branch) — same root causes, different roles/routes, deliberately left for a separate pass.

- **Issue 0.1 — Business Head also lands on Settings instead of Dashboard at login.** Same root cause as the Site Admin fix already applied: `Business Head`'s stored `permissions` lists Settings paths before `/secure/dashboard` in its `site` resource entry (`sql/ddl/005_seed.sql`, live `app_role` table, id 1). Needs the same reorder applied to Site Admin.
- **Issue 0.2 — Settings › Delivery Partners is a dead link.** The nav item is shown to any role with the `purchases` permission (`secured.component.html`), but no role's stored permissions actually include `/secure/settings/delivery-partners` — only `/secure/purchases` and `/secure/purchases/vendors`. Clicking it trips `AuthGuard` and bounces to `/login`, same symptom as the Settings-menu bug. Needs the path added to the relevant roles' `purchases` permission block (Business Head, Store Head, Sales Staff — whichever should have it). Documented as `DLVP-3` in `docs/testing/manual-test-plan.html`.

**Impact:** both are real, reproducible logouts for roles other than Site Admin — same class of bug as what was just fixed, just not yet swept for every role/route.

---

## Priority 1 — Correctness Risks 🔴

- **Issue 1.1 — No currency formatting standard; one screen shows raw float noise.** No `currency` pipe usage and no `LOCALE_ID`/`registerLocaleData` anywhere in the app, so all number/date pipes silently default to `en-US` grouping instead of Indian lakh/crore grouping. Money is rendered at least five different ways depending on screen:
  - Dashboard & Cash show numbers with no ₹ symbol at all (`dashboard.component.html:20,25,49,63,72,73`, `cash.component.html:13,21,25,43-45`).
  - Shifts list omits ₹ (`shifts.component.html:71,73,74,76`) but its own report modal a few lines later *does* prefix a literal ₹ (`shifts.component.html:116-192`) — same component, two conventions.
  - Invoices formats to nine decimal places (`invoices.component.html:52`, `invoice-list.component.html:77`) — real risk of values like `1234.999999998` showing on live data.
  - Customer Orders shows a ₹ icon next to a completely unformatted raw number (`customer-orders.component.html:29`).
  - **Impact:** first thing a pharmacy owner will scrutinize; the 9-decimal case is a correctness bug, not just style.

- **Issue 1.2 — Errors fail silently almost everywhere.** Only ~4 of ~80 component files touch `MessageService`/`p-toast`/`catchError`. A failed save or failed load has nowhere to surface. Confirms `XCUT-4` in `docs/testing/manual-test-plan.html`.

- **Issue 1.3 — No table shows a loading or empty state.** Sampled `product-list`, `vendor-list`, `invoice-list`, `sales-list` — none bind `[loading]` or render an empty-state template. A slow call and a genuinely empty result look identical: a bare header row.

- **Issue 1.4 — Two Sales tab-bar labels don't go where they say.** In `sale-header.component.html`: the **"Reports"** tab (line 20) routes to `/secure/sales/list` (the sales list), not the actual Reports module. The **"Customers"** tab (line 29) routes to `/secure/sales/reminders` (payment reminders), not a customer view. Actively misleading, not just inconsistent naming.

- **Issue 1.5 — Required-field asterisk is invisible.** `customer-form.component.html` and `product-form.component.html` mark required fields with `<span class="required">*</span>` six times — `.required` is not defined anywhere in `style.css`, so it renders in plain body color. The correct version, `text-danger`, sits in `product-form.component.html:64` in the *same file*.

- **Issue 1.6 — Inline form-validation feedback exists on 1 of 82 screens.** Only `purchase-request.component.html:53-88` explains what's wrong with a field. Every other form (Customer, Product, Vendor, User, Sale Delivery, …) just disables Save with no message.

---

## Priority 2 — Consistency Gaps 🟡

- **Issue 2.1 — No design system; CSS is the unmodified vendor demo theme.** `assets/css/style.css:1-18` still carries the stock NiceAdmin accent (`#4154f1`) and background (`#f6f9ff`). No token layer, no brand or pharmacy-specific palette decision anywhere.
- **Issue 2.2 — Status badges reinvented per module.** Purchase Orders compute badge classes in TS (`purchase-order.component.ts:101-116`); Shifts inlines the same idea as a template ternary (`shifts.component.html:78`); Invoices shows paid/outstanding as a plain number with no badge at all. Same semantic state doesn't look the same twice.
- **Issue 2.3 — "Create new" action worded three ways for the same action.** "Add New" (most lists) vs. "Create PO" (`purchase-order.component.html:4`) vs. "Add Request" (`purchase-request.component.html:3`).
- **Issue 2.4 — "Save this form" worded three ways, sometimes within one module.** "Save" (Customer, Purchase Settings, Product Price) vs. "Submit" (Vendor, Sale Delivery, Product, User Edit) vs. "Save Request" (Purchase Requests).
- **Issue 2.5 — Two of three loaded icon fonts are never used.** `index.html:25,28` load `boxicons` and `remixicon`; zero `bx-*`/`ri-*` usage found anywhere. Pure dead weight on every page load.
- **Issue 2.6 — Delete icon loses its red "destructive" color on two screens.** `stock-products.component.html:56` and `product-list.component.html:92` hardcode `style="color:gray"` instead of the `text-danger` used everywhere else for the same trash icon.
- **Issue 2.7 — Edit icon glyph inconsistent.** `bi-pencil` (Users, Roles, Invoices) vs. `bi-pencil-square` (Customers, Products, Vendors, Stock, Delivery Partners) for the identical action.
- **Issue 2.8 — Wide tables have no responsive wrapper.** Screens with 8–10+ columns (e.g. `product-list.component.html`) have no `overflow-x` container and no `[scrollable]` binding — they'll break layout rather than scroll on narrow viewports.
- **Issue 2.9 — Settings' new sidebar flyout is a second navigation idiom.** Products, Sales, Purchases, and Store all share one pattern: `pagetitle` + `h1`, then a horizontal tab bar (`routerLink`/`routerLinkActive`). This session's Settings sidebar expandable flyout (`secured.component.html:132-164`) is reasonable in isolation but now sits beside that shared idiom as a second, different pattern. Worth a deliberate call on direction, not a silent divergence. (The relocated Purchase Settings tab does correctly follow the shared tab-bar convention it was added into — no issue there.)
- **Issue 2.10 — Dates follow no shared convention.** Most of the app's ~50 `| date` usages fall back to Angular's default `mediumDate`; a handful hardcode `dd/MM/yyyy`, `dd MMM yyyy`, or `dd/MM/yy h:mm a`.

---

## Priority 3 — Polish / Cosmetic 🟢

- **Issue 3.1** — Dead commented-out title markup in `sales-list.component.html:1-2` and `sale-returns.component.html:1-2`.
- **Issue 3.2** — `customer-form.component.html:1` has a bare `<h1>` without the shared `pagetitle` wrapper, so its spacing drifts from every other screen.
- **Issue 3.3** — Two unrelated screens both titled bare "Dashboard" with no disambiguation (`dashboard.component.html:2`, `sale-dashboard.component.html:1`).
- **Issue 3.4** — Logo `alt=""` (empty) on `login.component.html:15`, `changepwd.component.html:11`, `secured.component.html:10`, `sale-view.component.html:7`. `document-viewer.component.html:2` (renders uploaded prescriptions) has no `alt` at all — the one with real consequence, since it's user-generated clinical content. `webcam-snapshot.component.html:11` also has no `alt`.
- **Issue 3.5** — "Purchase" (left-nav label, `secured.component.html`) vs. "Purchases" (module name and every page header inside it).
- **Issue 3.6** — `p-table` `styleClass` drifts slightly per screen (`p-datatable-gridlines mt-4` vs. adding `p-datatable-sm` vs. plain `mt-2`) — no functional impact.
- **Issue 3.7** — PrimeNG's `pButton`, the pattern documented in `api-v2`/frontend's own CLAUDE.md, is used in exactly 1 of 82 templates (`product-price.component.html`); everywhere else is plain `btn btn-primary`. Internally consistent, but a doc-vs-reality gap worth resolving one way or the other.

---

## What's Already Working — protect these when touching nearby code

- **Table pagination** is genuinely consistent: `[paginator]="true" [rows]="10" [showCurrentPageReport]="true" [rowsPerPageOptions]="[10,25,50]"` repeats near-identically across Products, Vendors, Sales, Invoices, and Delivery Partners.
- **Sidebar collapse/drawer mechanism** (`secured.component.ts`: `sidebarCollapsed`, `sidebarDrawerOpen`, `isMobileViewport()`) is real and centrally implemented — a solid foundation for the rest of the responsive story.

---

## References

- Full interactive audit (filterable by severity, file:line citations): published artifact from this session, "RGP Back Office — Interface Audit."
- Manual test plan cases tied to this backlog: `AUTH-11`, `AUTH-12`, `PO-9`, `DLVP-3` in `docs/testing/manual-test-plan.html`.
