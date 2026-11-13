# Purchase requests: several products at once, and requests across stores (analysis 2026-11-13, nothing built)

Two questions: (1) let a request carry several products (product + qty, everything else shared, same vendor); (2) review request and order as a whole, given that a store's sales staff raise requests and the buyer may sit in another store or a warehouse.

## Decisions (2026-11-13) and status
- **Supply:** warehouse/hub is future scope; stores are supplied directly for now (phase D deferred). **One buyer for all stores.** **Requesters see their whole store's requests** (without vendor or notes; a customer's name and phone only on requests they raised themselves).
- **Phase A BUILT 2026-11-13 (migration 197, uncommitted):** `purchase_request_group` + `purchase_request.group_id/store_id` (backfilled from the creator's store; rows with no clear store stay "unassigned", the buyer assigns them from the Store filter and the edit form). `POST /purchaserequests/slip` (one transaction; shared fields copied onto each row; a repeated product is added up), `POST /purchaserequests/slip/:id/lines` (more products while a line is Open; a product already on the slip has its open line raised), the asking store stamped on every new request (the person's own store, or any store of the business for the buyer; refused otherwise), store-wide visibility for request-only roles, store name on each row, store and slip filters (`/filter` takes `storeid` ('none' = unassigned) and `groupid`), quantity must be a whole number from 1 (checked in the service: the app has no global validation pipe, so DTO rules are not enforced). Customer commitments raise their requests as one slip, for the commitment's store. Screen: Add Request builds a list (Add to the list; what is in the box when Save is pressed is added too; one product still saves as an ordinary request); a slip badge on each row (click to show only that slip); + on an Open slip row adds more; a Store column and filter when the business has several stores.
- Verified on the scratch database: `qa/specs/purchase-request-slip.spec.ts` (5 tests, API and browser), `request-slip-rules.spec.ts`; the existing unlisted-request, intent, po-invoice and po-cancel specs still pass. Two purchasing-access menu specs (PACC-3, PACC-6) fail on a nav list that other features changed, unrelated.
- **Other stores are future scope (owner, 2026-11-13): nothing more is built for them now.** Deferred: ship-to store on orders, invoice taking the ship-to store, store-aware Reorder, bulk assign-store, hub/warehouse, other-store stock in the dialog. With one store the store field, column and filter do not show and the store is stamped silently, so phase A costs nothing today. Still open and not store-related: decline/cancel with a reason and requester-visible status, a buyer worklist by vendor and product.
- **Not built:** phases B to E (buyer worklist and ship-to, decline with reason and requester alerts, hub, overlap warnings); the arrival alert is still one per request; the Reorder screen still makes store-less orders; a bulk "assign store" action for unassigned requests (the edit form can set it).

## 1. How it works today (read from the code)

- **A "request" is one row = one product.** `purchase_request` holds the product (or a typed name), qty, and every other field on the same row: type, source, priority, needed-by, customer name/phone, source reference, notes, vendor, status, ordered/fulfilled qty, `order_id`. There is no header.
- **A purchase order is a header whose lines are request rows** (`purchase_request.order_id`). Invoice lines point back at the row (`purchase_invoice_item.request_id`); receiving updates `fulfilled_qty` on the row (`syncRequestFulfilment`) and moves it to Received. Customer commitments, the "customer request arrived" alert and the till's "request a product we don't have" all create or read rows.
- **No store anywhere on a request or an order.** The store is only implied: the requester's store by `created_by` -> `user_stores`; the receiving store is chosen on the invoice (the invoice form defaults to the header's selected store, the API to the business's first store); the PO print's "deliver to" is the store of the person who made the PO; the "request arrived" alert finds the store from the receiving invoice.
- **Who sees what:** a role with only `purchases.request` (Sales Staff, Counter) sees only requests it created, without vendor and internal notes (`ownerOf`). Anyone with `purchases.add` sees every request, with no store filter or column. The list endpoint has no business filter of its own (fine while each business has its own database; wrong in a shared one).
- **Stock transfer exists** (`store_stock_transfer`: from store, to store, IN_TRANSIT, received qty), keyed to a purchase item.
- **Small defects seen:** the request DTO allows `qty` 0 (`@Min(0)`) although the screen says at least 1; there is no way for the buyer to decline a request with a reason (only delete), so the requester just sees it vanish or sit Open.

## 2. Several products in one request

**Recommendation: a request "slip" over the existing rows. Do not turn the row into header + lines.**

Everything downstream (PO lines, invoice receipt, fulfilment, commitments, alerts, per-product status) is keyed on the row. Making the row a header would rewrite all of it and the QA specs. A slip keeps the row as the unit and adds only grouping:

- New small table `purchase_request_group` (id, store_id, created_by, created_on, note). `purchase_request.group_id` (nullable: every existing row stays valid, single requests need no group).
- **The shared fields are copied onto each row** when the slip is saved (type, source, priority, needed-by, customer, source reference, notes, vendor). So "all other fields remain the same" is literally true, and no reader changes. Per-line fields: product (or typed name), qty, an optional line note.
- API: `POST /purchaserequests/slip` with the shared fields and `lines: [{productid | requestedname, qty, note?}]`, one transaction, same permission as today (`request`), same requester restrictions (vendor and notes ignored for request-only roles). The existing single POST stays.
- Rules: at least 1 line, at most about 50; each qty >= 1; the same product twice in a slip is merged (qty added) or refused with the name; a typed (unlisted) name is allowed per line, with the same "link before ordering" rule; a vendor on the slip must be usable (`assertVendorUsable`), applied to every line, still changeable per row by the buyer.
- **Screen:** the dialog becomes header (once) + a lines table. Pick a product -> qty -> Add; the stock summary shows for the product being picked; lines can be removed before saving; Enter adds the line and returns focus to the product box (counter speed). Editing an existing row stays as today; a row that belongs to a slip shows its slip number and "add more to this slip" while the row is still Open.
- **List:** show a Slip column and group rows by slip (expandable), status per row as today; a slip status is derived (all Open / partly ordered / all received). Filtering by slip number.
- **Ordering:** unchanged. Rows of one slip may go on different orders (different vendors) because each row has its own `order_id`. Add "select all rows of this slip" when making an order.
- **Other places to touch:** the "customer request arrived" alert could say "3 items for Mrs X arrived" once per customer per slip instead of one alert per row; the commitments module can use a slip per commitment later; the till's single-product request stays single. QA: new spec for the slip (create, merge/refuse duplicates, requester sees own, buyer sees vendor, order from slip); the existing request specs are unaffected because the single POST stays.

Effort: one migration, one service method, one dialog rework, one list change. Low risk to the rest.

## 3. Requests across stores: gaps

| # | Gap | Effect today |
|---|---|---|
| G1 | No `store_id` on a request | The buyer cannot tell which store wants what, cannot prioritise or split by store, and a request from store B can be received into store A if the receiver does not change the invoice's store. |
| G2 | Requesters see only their own rows | Two staff on one shift (or the Counter login and a person) can raise the same request twice; the Store Head cannot see "my store's requests" unless they hold `purchases.add`, in which case they see everything. |
| G3 | The order has no "ship to" | A purchase order for several stores' requests prints one delivery address (the maker's store). The invoice's receiving store is a manual choice on a separate screen. |
| G4 | One invoice line = one request row | A vendor line covering the same product for three stores cannot be allocated to the three requests. |
| G5 | No way to decline or answer | The buyer can only delete; the requester gets no status (only the customer-request alert exists, and only for requests with a customer). |
| G6 | No view of overlap | The same product requested by two stores, or twice by one, is not shown to the requester or the buyer; other stores' stock is not shown to the requester. |
| G7 | Suggestions (Reorder) are store-scoped but the orders they create are not | A store-level reorder becomes a store-less order. |

## 4. Design for stores

**Stamp the store on every request.** `purchase_request.store_id` (and `purchase_request_group.store_id`), set at creation from the store the person is working in (the header store switcher; the Counter login's store). A person assigned to several stores picks one in the dialog; one store is silent. Backfill: the creator's first `user_stores` store, else NULL ("unassigned", shown as such). This is the single change that unlocks everything below.

**Visibility rules (who sees which requests):**
- Sales Staff / Counter: all requests of their own store (not only their own), no vendor, no internal notes. Stops duplicates and lets a shift see what is already asked for.
- Store Head: their store(s), with vendor and status.
- Purchase staff (`purchases.add`), wherever they sit: every store of the business, with a Store column, a store filter and "group by store". Their own location does not limit them.

**Two supply models; support both, per store (or per business):**
1. **Direct.** The buyer orders per requesting store; the vendor delivers to that store; the invoice's receiving store is the request's store. The invoice from a PO defaults its store to the PO's ship-to store instead of the person's header store.
2. **Hub / warehouse.** The buyer consolidates several stores' requests for a vendor into one PO that ships to the hub; stock is received at the hub; the hub sends each store its share using the existing stock transfer; the request closes when the store has received it. Needs: `purchase_order.ship_to_store_id`; each row keeps its own destination store (`request.store_id`); statuses extended: Received (at the hub) -> In transit -> Delivered (at the store); allocating a received invoice line across the requests it covers (G4: an allocation table `purchase_request_receipt (request_id, invoice_item_id, qty)` replaces the single `request_id` on the invoice item for this case only; the current column stays for the direct case).
   The vendor-facing PO print can total a product across stores while the internal view keeps the per-store split.
   A store flag is enough to mark a hub (`stores.is_hub`, or reuse `store_type = 'other'` for a warehouse; four such stores already exist) and an optional `supplied_by_store_id` for who restocks whom.

**Buyer worklist.** A screen of Open requests grouped by vendor then product, with the quantity split by store, urgency (needed-by, priority) and what is already on an open order; select rows -> create (or add to) a PO per vendor with the ship-to store chosen. This replaces opening rows one by one, and it is where the slip pays off (one slip = one row group to tick).

**Answering the requester.**
- Statuses added: Declined (reason required), Cancelled; "Substituted by" (another product) as a decline reason.
- The requester sees status, ordered/received quantity and the buyer's reason, never the vendor or the cost.
- Notify the requesting store when the stock is in (extend today's customer-only alert to every request: "3 items you asked for arrived at <store>"); with the hub model also when dispatched.

**Overlap and stock at request time.** In the dialog show: already requested for this store (qty, status) and for other stores; stock in this store and in other stores of the business. If another store holds enough, offer "ask <store> to transfer" (a transfer request, phase 3) instead of a purchase.

**Reorder suggestions.** Carry the store scope into the requests/orders they create (G7).

**Smaller fixes along the way:** qty >= 1 on the request; the PO print's "deliver to" from the PO's ship-to store; a business filter on the request list.

## 5. Suggested order of work

| Phase | What | Why this order |
|---|---|---|
| A | Slip (group) + `store_id` stamped + the new dialog + store column/filter + requester sees own store + qty >= 1 | The dialog changes once; the store stamp is the dependency of everything else; no change to orders or invoices. |
| B | Buyer worklist (by vendor/product/store), PO `ship_to_store_id`, invoice-from-PO takes the ship-to store, PO print from ship-to, Reorder keeps the store | Direct model complete: the common case. |
| C | Decline/cancel with reason, requester-visible status, arrival and decline alerts to the store | Closes the feedback loop. |
| D | Hub model: consolidated PO to the hub, receipt allocation across requests, dispatch via stock transfer, Delivered status | Only if stores really are supplied through a hub or warehouse. |
| E | Overlap warnings and stock of other stores in the dialog; transfer-instead-of-buy request | Convenience; depends on A. |

## 6. Questions that change the design

1. Do stores get goods **directly from vendors**, **through a warehouse/hub**, or **both** (some vendors direct, some via the hub)? This decides whether phase D is needed.
2. Is there **one buyer for all stores**, or a buyer per hub/region? (Decides whether purchase staff see all stores or only the stores a hub serves.)
3. Should **requesters see their whole store's requests**, or only their own? (Recommended: the whole store, without vendor.)
4. A slip has **one vendor** by your description: should the requester ever pick it, or does only the buyer set it (today only the buyer can)? (Recommended: buyer only; a slip's lines may still end up on different vendors' orders.)
5. When the same product is requested by several stores, should the buyer's PO show **one line per store** (clear for delivery) or **one summed line** (clear for the vendor)? (Recommended: per-store lines internally, summed on the vendor print.)
6. Is a **declined** request something the requester should be told about (alert) or just see on the list?

## 7. Risks

- Backfilling `store_id` from the creator is a guess for people who work in several stores; rows with no clear store stay "unassigned" and the buyer assigns them (bulk action).
- Changing who sees what (G2) changes the Sales Staff/Counter list from "mine" to "my store's"; no vendor or cost is exposed, but names of customers on special orders are: show customer name and phone only to the creator and the buyer.
- Phase D touches receiving (invoice items) and the fulfilment sync: the riskiest part; do it last, behind the store/business setting, with the direct model untouched.
