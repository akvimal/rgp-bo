# Recognition and compliance: rewarding good work and making the missed things get done

Status: **design, not built** (2026-10-25). Follows `DASHBOARD_AND_MENU_DESIGN.md` (the Counter view shows goals and badges; the Owner and Store views show compliance). Uses what exists: the alerts engine, the notification channels, shift checklists, the sale `check` and `saved` hooks, approvals, the weekly review, the stock-count escalation and the GST month lock.

## 1. The idea in one paragraph

Two halves of one system. **Recognition** notices good habits from the data and says thank you at once. **Compliance** knows what each person and store owes (a count, a register entry, a licence renewal, a close) and, when it is missed, climbs a ladder: reminder, nudge, "do this to continue", escalation to the person's head, and only for what the law or the cash really needs, a block. The two meet in one place: **a missed compliance pauses the streak and the badges of the person who owns it** until it is put right, and putting it right is itself recognised. People should feel the system is on their side: it tells them what to do before it stops them, and thanks them when they do.

## 2. What the system enforces today (so the proposal builds on it)

| Where | What is already refused or required |
|---|---|
| Billing | A shift must be open; a counter bill must be fully paid; the price may not exceed the MRP; a scheduled drug needs the patient and prescriber (drug register); older or short-dated batches need a confirmation and may need a reason; an issued tax invoice cannot be edited; a tax invoice cannot be dated into a closed GST month |
| Shifts | Opening and closing tick the shift checklists; the server insists on the core cash counts; a shift cannot be closed twice |
| Cash | Deposit-due is raised by amount or schedule (an alert) |
| Stock | A count that differs by more than the set value goes to the Business Head and needs a recount |
| Oversight | Weekly review to sign; outage kit weekly check; licence and registration expiry alerts |

What is missing: these are separate checks with no single list of "what is owed by whom", no ladder, no escalation by time, no record of why something was missed, and nothing that connects them to praise.

## 3. Compliance: one register of what is owed

### 3.1 Items

Each thing that must be done is an **item** in a register, defined once and generated for each store (and person where it is personal):

| Class | Examples | Default enforcement |
|---|---|---|
| **Legal** | drug register entry on a scheduled sale; licence valid to sell; pharmacist registration valid; tax invoice details; GST month closed by the due date; no expired batch sold | block the specific action |
| **Cash and money** | shift counted and closed; deposit made when due; digital payments matched; discrepancies explained; stock adjustment approved | required to continue (soft block) |
| **Operating** | stock count by category; outage kit checked; opening and closing checklists; weekly review signed; price policy exceptions cleared | nudge, then required |
| **Customer and quality** | a mobile number on bills; refill calls made; deliveries handed over; complaints answered in time | nudge only; never blocks |
| **People** | leave decided; registration renewal; training | nudge, escalate |

Each item carries: its owner (a role, then the person on duty or assigned), how its due date is worked out (from facts that exist: the licence end date, the days since the last count, the close of a shift, the 11th of the month), its pack or module (a pharmacy item exists only for a pharmacy), and its **ladder**.

### 3.2 The ladder (time and severity)

| Step | When | What the person sees | Who else knows |
|---|---|---|---|
| 1. Reminder | before it is due | an item in the Inbox and on the dashboard: "Do before you close" | no one |
| 2. Due | on the day | a banner on the dashboard and, for shift items, on the till screen; one tap opens the action | no one |
| 3. Late | overdue | the banner turns firm and persists; the item appears in "Needs you now" | the store head is told |
| 4. Required | overdue a set time, or at the next shift open or close | **"Do this to continue"**: a short dialog at the next natural pause (shift open, shift close, next login), with the action or a reason | the store head sees the reason |
| 5. Escalated | overdue longer | | the Business Head is told; it enters the weekly review |
| 6. Blocked | only for items marked legal or cash-critical | the specific action is refused with a clear sentence and a way out | the owner is told |

Rules that keep it fair and workable:

- **Never block the whole till for something that is not legal.** A block is always of the one action it protects (completing a scheduled-drug bill without the register, closing a shift without a count, dating an invoice into a filed month). A late stock count blocks nothing at the counter; it blocks closing the *next* shift until done or waived.
- **Say what to do, not just that it failed.** Every block names the item, the one-tap action and who can waive it.
- **A waiver is a decision, not a loophole.** Only the **Business Head** can grant a **time-limited waiver with a reason**, for any item. The store head can *ask* for one from the item itself (with the reason), and the Business Head is told at once. A waiver is recorded, shown in the weekly review, and expires. No one waives their own item.
- **Attribution is by duty, not guesswork.** An item belongs to the role and, where it is personal (a shift's close, a parked bill, a refill call), to the person on duty. Items outside someone's shift are not counted against them.
- **A way to say "not mine" or "this is wrong".** One button sends it to the store head with the reason; the item is paused while it is looked at.
- **Pharmacy and other packs add their own items**; a business that is not a pharmacy never sees them.

### 3.3 What a person experiences

- Morning: "2 things to finish today: the stock count for Branch, last week's outage kit check." Each opens its screen.
- During the day: nothing intrusive unless something is late.
- Close: the closing dialog lists anything still open; items are done there or given a reason.
- Late legal item: "This bill has a Schedule H1 medicine. Add the patient and prescriber to complete it." (as today)
- Escalation is quiet and private: the person's head is told, not the whole shop.

## 4. Recognition: noticing and thanking

### 4.1 What earns recognition

Habits that matter and that the data can verify, never raw sales alone and never anything a person could game by discounting or pushing a product:

| Habit | Measured from |
|---|---|
| Accurate till | shift closes with a difference under a set amount, in a row |
| Customer capture | share of the person's bills with a real mobile number, over days |
| Refill follow-up | refill calls made and recorded, over days |
| On-time deliveries | handed over within the time, over days |
| Rush-hour handling | bills in the busiest hour with no complaint |
| Beating one's own usual | sales above the person's own usual, on enough days |
| Compliance clean | no overdue item of their own for a period |
| Initiative | a stock-out request raised that was bought; a complaint resolved |

Each is a **rule**: an event or a daily/weekly measure, a threshold, a period, and a reward. The Business Head chooses which rules are on and their thresholds (defaults provided). Every award stores its **evidence** (the shifts, bills or days that earned it) so it can be shown and checked.

### 4.2 What the person gets

- **At the moment:** a short celebration when they next open the dashboard or the till ("Badge earned: Accurate till, 10 shifts in a row. Thank you."), with a link to the evidence.
- **In the Inbox:** an appreciation card that stays; a monthly summary of what they achieved.
- **From people:** the store head or owner can send a one-line thanks from the Staff and quality page, or accept the system's suggestion ("Staff 1 earned three badges this month: send thanks?"). A note arrives in the person's Notes.
- **To the heads:** a quiet "recognise" prompt on the Store and Owner views when someone earns something or reaches a milestone.
- **Optional, outside the system:** where the business gives a reward (a small bonus, an extra holiday), the award can be marked "reward promised" for the store head to act on; paying is not automated. A later link to the HR staff rating and payroll incentives is a separate decision.

### 4.3 Guards against misuse

- Badges reward habits and care, never volume of one product or deeper discounts. Discount rate and returns rate are watched; a spike pauses the "beat your usual" badge for review.
- A badge is for a period or a streak; it **lapses** when the habit stops, so it means something.
- No public ranking and no leaderboard of people. The team sees shared goals; each person sees their own badges.
- Monetary or other rewards need the head's approval; the system only records the decision.

## 5. Where they meet

- **A missed item of your own pauses your streak and new badges** until it is done. The Counter view says it kindly: "Do the stock count to keep your 12-shift streak."
- **Putting it right is recognised:** "Cleared 3 late items this week" earns the compliance-clean progress back.
- **A store is "clean" when none of its items is overdue.** The team badge "Compliance clean week" is shared by the people on duty that week, and the store health check for compliance rises with it.
- **The Store and Owner views show compliance by item and by store, not by person**, so the conversation is about the work. The person's own list is theirs; the head sees the late and waived items with reasons.
- **The weekly review** gains a compliance page: items late, items waived with reason, items escalated, awards given.

## 6. How it is built on what exists

| Part | Built on |
|---|---|
| Item register and instances (`compliance_item`, `compliance_instance`, `compliance_event`) | new tables; due rules read the existing facts (licences, stock counts, outage kit, checklists, GST months, deposits) |
| Generation, reminders, escalation | the alerts engine (a kind per class) and the notification channels (in-app, Telegram) |
| Soft blocks ("do this to continue") | shift open and close, and login, where the checklist logic already sits |
| Hard blocks | the sale `check` hook and the existing refusals; new ones only for legal items not yet covered |
| Waivers | the approvals pattern (the Business Head approves; a store head can request; reason, expiry, audit) |
| Recognition rules and awards (`recognition_rule`, `recognition_award` with evidence) | new tables; measures from sales, shifts, deliveries, refills, requests |
| Celebration and notes | the Inbox and the Counter view; the Staff and quality page for thanks |
| Visibility | the dashboard views by role (D1) and the weekly review |

## 7. Phasing

| Phase | What | Size |
|---|---|---|
| R1 | The compliance register: items and instances for what already exists (licences, stock counts, outage kit, checklists, deposit, GST month, weekly review); reminders and the late and escalated steps through the alerts engine; the person's "to do" list and the head's "late" list | M |
| R2 | "Do this to continue" at shift open and close and login; reason capture; waivers with expiry; "not mine" dispute | M |
| R3 | Recognition rules, awards with evidence, celebration, Inbox cards, streaks that pause on a missed item, thanks from the heads | M |
| R4 | The compliance page in the weekly review; store health tied to the register; compliance by item and store on the Owner and Store views | S to M |
| R5 | New hard blocks for legal items not yet covered; pharmacy-pack items | S to M |
| R6 | Optional: reward promised, link to staff rating and payroll | decision first |

R1 and R3 can start together; R2 depends on R1. The dashboard work (D1) shows the results, so build it first or beside R1.

## 8. Risks

- **Punishing instead of helping** turns staff against the system. The ladder starts with help, keeps escalation private and never blocks the till for non-legal items.
- **Gaming** (badges for volume or for fast closes without care). Habit rules only, evidence kept, discount and return spikes pause awards.
- **Unfair blame** for things outside a person's duty. Attribution by duty and shift, a dispute button, waivers.
- **Alert fatigue.** One list, grouped, sorted by what is late; reminders only before due; nothing repeats within a day.
- **A rule that is wrong blocks real work.** Every block has a waiver path and an owner who can reach it quickly, and each new hard block is introduced as "required" first and watched before it is made a block.

## 9. Decisions taken (2026-10-25)

1. **Blocks:** only legal items and the shift close count block an action. Cash and shift items, and stock counts overdue past a set time, are "do this to continue". Everything else nudges and escalates. (As suggested.)
2. **Escalation:** the store head is told after one day, the Business Head after three. (As suggested.)
3. **Waivers: the Business Head only**, with a reason and an expiry (a maximum length to be set with the first build). A store head can request one.
4. **Compliance informs the monthly staff rating**; it has no automatic effect on pay. (As suggested.)
5. **Rewards are badges and thanks only.** No "reward promised" and no payroll link.
6. **Badges are visible to the heads for everyone, each person sees their own; there is no leaderboard.**
7. **Order:** R1 with the dashboard shell (D1), then R3, then R2. (As suggested.) R6 is dropped, since rewards are badges and thanks only.

## 10. Configurable by business (decided 2026-10-25)

Every business runs its own way, so nothing above is fixed in code. A business gets **defaults from its business type and packs**, then adjusts them.

### 10.1 What a business can configure

| Area | What it sets | Limits (the floor) |
|---|---|---|
| **Dashboard views** | which view each role gets; which widgets show in a view, their order and which sections are collapsed; the default period and comparison; sales with or without GST | a view never shows data the role may not see (cost and margin stay owner-only; the Counter never shows personal figures) |
| **Store health** | the seven checks that count, their weights, the thresholds for Healthy, Watch and Act now | the safeguard stays: a check under 60 holds the whole at Watch (the threshold can be changed, the safeguard cannot be switched off) |
| **Targets** | monthly sales target per store; the personal goal rule (own usual plus a stretch, or a number the Manager sets) | |
| **Compliance register** | which items exist for the business; their owner role; due rules (days, schedule); their class | legal items of the business type's pack exist and cannot be removed (a pharmacy's drug register, licence and registration expiry) |
| **The ladder** | for each item: days before the reminder, when it is late, when "required" starts, escalation days (default store head 1, Business Head 3), the maximum waiver length | blocks can be added to an item, but a **legal block cannot be removed or weakened**; "block" can be set only on items marked cash-critical or legal |
| **Recognition** | which badge rules are on; thresholds and periods (for example ten shifts in a row, 95% of bills with a mobile number); whether the Manager and owner get suggestions to send thanks | rules measure habits only; a rule on raw sales, discount depth or volume of a product cannot be created |
| **Notes and channels** | who may send thanks; delivery in the app, by Telegram or both; language (English, Tamil) | |
| **Wording** | the business's own names for items (a general business says "item", a pharmacy "medicine") and its badge names | |

### 10.2 Layers

Platform defaults, then the **business type and its packs** (a pharmacy starts with the pharmacy items and rules; a general business with the base set), then **the business**, then an optional **store override** for the few things that differ by store (targets, an item that exists only at one store, a different escalation for a store with no store head). The most specific layer wins, within the floor above. A new business gets a working setup on day one without configuring anything.

### 10.3 Who and where

- Only the **Business Head** configures. The Manager sees the rules that apply to the store (read-only, with the reason) so nothing is a surprise.
- One screen under Setup: **Dashboards and compliance**, with tabs for Views, Goals and badges, Compliance, Health and targets, and Wording. Each tab shows the default next to the business's choice and a **Reset to default**.
- **Preview as**: choose a role and see its dashboard with the changes before saving.
- Every change is **audited** (who, what, from, to) and **dated**: a change of a ladder timing or a threshold takes effect from a date, so an item already late is not re-judged retroactively.
- Plans (the SaaS control plane) can limit what a business may configure (for example custom badge rules only on a higher plan), the way modules are limited today.

### 10.4 How it is built

| Part | How |
|---|---|
| Defaults | a config shipped with each pack (like `GET /packs/config` today: labels, product attributes), extended with views, widgets, items, ladders, badge rules |
| Business and store overrides | `dashboard_config` (business, optional store, role, view JSON), `compliance_item_config` (item, business, store, enforcement, ladder days, owner role, active), `recognition_rule_config` (rule, business, thresholds, active), `health_config` (weights, thresholds), `metric_target` |
| Effective config | one resolver (pack default, then business, then store, clamped to the floor) used by the dashboard, the register and the recognition engine, cached briefly and cleared on save |
| Floors | declared in the pack with the item or rule (`legal: true`, `min_enforcement`, `removable: false`) and enforced by the resolver and the save endpoint, not by the screen |
| Audit and dates | the existing audit service; each config row carries `effective_from` |

### 10.5 Phasing change

Configuration is built **with** each part, not after: R1 (the register) ships with `compliance_item_config` and the ladder settings; D1 (the shell) with `dashboard_config` and the health weights; R3 (recognition) with `recognition_rule_config`. A single Setup screen collects them (a new phase **C1**, after R1 and D1), with Preview as and Reset to default.

### 10.6 Decisions to take

1. Is a **store override** wanted from the start, or business-level only first? (recommended: business-level first, store override for targets only.)
2. Which settings may a plan limit?
3. Should the Manager be allowed to adjust anything (recommended: no, only the Business Head)?

