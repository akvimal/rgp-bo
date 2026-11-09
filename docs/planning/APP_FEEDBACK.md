# App feedback: report an issue, ask a question, suggest a feature, see the reply

Status: designed 2026-11-09. **Phase 1 built and verified 2026-11-09** (scratch database, API script, browser), committed. Phases 2-3 not built.

## Decisions

1. **Entry point is the floating quick-actions button** (bottom right, the lightning bolt), not the header. A new item "Report or suggest" opens the form. It follows the button's rules: hidden on the billing screens, not drawn when printing.
2. **Module and feature pickers come from the app guide**, not a new list. `frontend/src/app/guide/app-guide-content.ts` already has one entry per menu page (id, group, title, route, tasks) and a test that keeps it in step with the menu. Module = a page the person can open (`visiblePages`); feature = one of that page's tasks, plus "Something else". The module is pre-selected from the screen the person was on.
3. **Assumptions (the user did not answer these; change if wrong):** managers answer (owners and anyone with `feedback.manage`); no ideas board in phase 1 (a report is private to its reporter and the triage people); screenshots allowed, viewing limited by the report's visibility, with a warning on the form not to include customer details.
4. **Replies and reminders use the alerts engine** (bell, Settings > Alerts snooze, staff Telegram), like to-dos. No second notification mechanism.

## What exists and is reused

- Grievances (`040_grievances.sql`): status, assignee, resolution and a timeline of notes. The report thread copies that shape.
- Alerts engine: `alert-kinds.ts` kinds produce findings with their own recipients (`Finding.recipients`), resolved when the finding stops appearing; `DEFAULT_RULES` + `ensureDefaults` make the rules for every business, so no data migration for rules.
- To-dos: the acting-operator pattern for the shared Counter login (`actinguserid` in the body, checked against the business and `NOT_A_PERSON`), and file attachments (upload with `?todo=<id>`, path checked under the upload folder).
- App guide, menu permissions (`any('x.view')`), permission catalogue, quick actions (`buildQuickActions`).

## What a person sees

- **Report or suggest** (floating button): kind (Something is wrong / I have a question / Suggest a feature / Wrong data), module, feature, a one-line title, then fields by kind. Problem: what happened, what they expected, how bad (blocks my work / has a workaround / small). Suggestion: what they are trying to do, and the benefit. Optional screenshot or PDF (up to 3).
- Captured automatically: the screen they came from, app version, role, store, browser, time.
- **Help and feedback** page (menu, under Learn): tab **My reports** (status chip, unread dot, the reply thread, a reply box when we are waiting for them, "this solved it" / reopen) and, for managers, tab **Inbox** (all reports, filter by status, kind, module, awaiting me; reply, internal note, change status, assign).
- The bell tells the reporter when there is a reply or a status change, and tells the triage people when a report is waiting for them.

## Lifecycle

`NEW` (sent) -> `IN_PROGRESS` (looking into it) -> `WAITING` (needs your reply) -> `ANSWERED` (answered or fixed, with text) -> `CLOSED` (reporter confirmed, or reopened back to `IN_PROGRESS`). Suggestions may also be `PLANNED`; any kind may end as `DECLINED` (with a reason) or `DUPLICATE` (points to the first report).
Two flags drive the alerts: `awaiting_staff` (the reporter spoke last, or it is new) and `reporter_unread` (staff spoke last and the reporter has not opened it).

## Data (migration 175)

- `app_feedback`: id, business_id, store_id, kind, module_id (guide page id), module_title, feature, title, details jsonb (the kind's fields), impact, status, assignee_user_id, reporter_user_id, created_by, context jsonb (route, version, role, browser), resolution, resolved_on, resolved_by, duplicate_of, awaiting_staff, reporter_unread, last_activity_on, created_on, archive.
- `app_feedback_note`: id, feedback_id, kind (REPLY / INTERNAL / STATUS), body, files jsonb, created_by, created_on. INTERNAL is never shown to the reporter.
- Permissions: `feedback.add` (everyone who works: report and see your own), `feedback.manage` (Business Head, Owner-operator: the inbox, reply, status, assign).
- Alert kinds: `feedback_reply` (to the reporter), `feedback_waiting` (to the triage people).

## Phase 1 as built

- **Migration 175** (+ rollback; re-runnable): `app_feedback`, `app_feedback_note`, and the permission `feedback` (`add` for every role that has the to-do list, `add` + `manage` for Business Head and Owner-operator). Store Heads can send and read their own but do not answer; give them `feedback.manage` in the role editor if they should.
- **API** `api-v2/src/modules/app/feedback/`: `GET /feedback/options`, `/mine`, `/inbox?view&kind&module&q`, `/:id`; `POST /feedback`, `/:id/reply` (reply, wait, internal note), `/:id/status`, `/:id/assign`, `/:id/close`, `/:id/reopen`. Rules in `feedback-rules.ts` (10 tests). A reporter sees their own reports and every reply except internal notes; a manager sees the business's. Reading a report clears `reporter_unread`. Rate limit 20 reports a day; up to 3 files, only from the upload folder's `feedback` area; the shared Counter login credits the acting operator (`actinguserid`).
- **Alerts** `feedback_reply` (to the reporter) and `feedback_waiting` (to everyone whose role has `feedback.manage`), with English and Tamil text; rules made by `DEFAULT_RULES`. The alert test lists both kinds.
- **Frontend** `frontend/src/app/secured/feedback/`: the report form is a dialog over the current screen, opened from the floating quick-actions button ("Report or suggest", `qa-feedback`; the item opens the dialog instead of going to a page); the module is pre-selected from the screen (`areaForUrl`) and the feature list is the guide page's tasks (`areasFor`, `featureLabel`, 4 tests). Page "Help and feedback" (menu: Learn group, also in the counter menu) with My reports (unread badge, thread, reply, "this solved it", reopen) and, for managers, the Inbox (Waiting for me / Open / Done / All, kind, module and word filters, reply, wait for reply, internal note, status, assign). Guide entry `nav-feedback` added (the guide must have one per menu page); permission catalogue entry added.
- **Verified 2026-11-09:** migration up, re-run and rollback on a scratch copy; a 35-step API script (send, refuse bad input and outside files, visibility, inbox filters, internal notes hidden from the reporter, waiting and reply loop, answer needs text, reopen, close, duplicate, assign); alerts raised with the right audience; in the browser as Sales Staff and Business Head: open the form from the floating button on the To-dos screen (module pre-selected, features from the guide), send, see it in My reports, answer from the Inbox with an internal note and an answer, see the answer, close it. 10 frontend unit tests and 117 related API tests pass; `ng build` passes.
- **Not done:** a Playwright spec for the feedback screens (the QA stack was not brought up); phone and dark-theme checks of the new screens; Telegram for replies (the alerts engine already offers staff Telegram for alerts, not tested for these kinds); serving report files through the report's own permission check; the phase 2 and 3 items above.
- Known roughness: the Business Head's alert bell takes up to a minute to show a new report (the alert engine runs each minute and a full run is slow on a large dataset).

## Phases

1. **Phase 1 (this build):** migration, API, report form from the floating button, My reports with thread and reply, Inbox with reply, internal note, status and assign, alerts, the guide-based pickers, tests.
2. **Phase 2:** reopen with a reason window, similar-report hints on submit, a "reports waiting" card for managers, per-module counts and time to first reply, Telegram for replies, optional ideas board with votes.
3. **Phase 3:** escalate to the product developer (a GitHub issue after a preview that strips personal data, or through the SaaS control plane), AI answers to "how do I" questions from the app guide and a drafted reply for triage, Tamil labels.

## Risks and notes

- Screenshots can show patient or customer data: the form warns; files are named by random ids but the generic file viewer is not report-aware, so a file is as private as its path. Phase 2 should serve report files through the report's own permission check.
- Free-text reports can hold personal data; keep access to the reporter and `feedback.manage`.
- The module list changes with the guide; reports keep the module title as text, so an old report stays readable if a page is renamed.
- Rate limit: a person may send at most 20 reports a day.
