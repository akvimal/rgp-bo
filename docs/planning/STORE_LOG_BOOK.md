# Store log book: goods out, equipment in, visitors

Status: **deferred** by the product owner (2026-10-23). Nothing here is built. Recorded so the analysis is not redone.

## Why

A store needs a record of things that leave or enter it outside normal sales and purchases, and of people who visit it: expiry clearance and disposal, damaged goods, samples taken by an inspector, appliances and fixtures that come in, a drug inspector, a service technician. Expiry and damage disposal should need approval.

## What the app has today

- Disposal exists only as a **stock adjustment** with a reason code (expired, damaged, returned to vendor, shrinkage, correction, other). It needs approval only **above a value threshold** (default 2,000), so small disposals post at once.
- An expiry view, a Vendor issues module (returns), the append-only audit log, store transfers.
- No record of the disposal method, a witness, or evidence; no visitor record; no equipment record; no single register to print for an inspection.

## Proposed: one log book per store, four kinds of entry

1. **Goods out** (expiry clearance, damaged goods, return to vendor, samples taken by an inspector, donation)
   - batches and quantities, reason, method (return to vendor / destroyed / authorised disposal agency / other), witness, photo or receipt.
   - **Approval always required for expiry and damage disposal, whatever the value.** Raised by anyone; approved by a Store Head or the owner. Stock drops only on approval; a rejection changes nothing. With the business or store approval mode set to "the maker may approve their own work", the owner approves their own, so a one-person shop is not blocked.
   - Built on the existing stock adjustment (the approval gate and reason codes), with the value threshold overridden for these reasons.
2. **Equipment in** (appliances, fixtures, devices; not stock): description, serial or asset number, supplier and invoice reference, warranty end, photo. Later service visits attach to the item; a warranty ending soon raises a reminder (same pattern as store licences).
3. **Visitors** (inspector, technician, auditor, company representative): name, organisation, designation, ID shown, purpose, time in and out, who attended, notes. For an inspection also: reference, whether samples were taken (links to goods out), remarks, follow-ups with a due date and an owner.
4. **Corrections**: entries are append-only (the audit log's pattern: a trigger blocks update and delete). A mistake is fixed by a new entry that points at the old one. The server stamps the time; on a shared counter login the person serving is recorded (the operator picker).

Cross-cutting: printable / exportable register; photos and certificates go through the document uploads, so they count toward the demo and trial document limits; the planned in-app reminders and notifications read from here (approval pending, follow-up due, warranty ending, expiry disposal due). If a legal format exists for the register, it should follow it: confirm with the pharmacist or licensing authority, do not guess.

## Build order (when resumed)

1. Disposal register on top of stock adjustments: mandatory approval, method, witness, evidence, and a "clear expiry" screen that starts from the expiry list.
2. Visitor log with inspection follow-ups.
3. Equipment log with warranty and service history.
4. Printable register.

## Open decisions

1. Who approves a disposal: Store Head and owner, or the owner only?
2. Is the photo or certificate mandatory for a disposal, or optional?
3. Do Schedule H and other controlled drugs need extra steps (a second witness)?
4. Is a log book a module a business can switch off (like expenses), or core? (Suggest: core, since it is about compliance; the approvals follow the approval mode.)
