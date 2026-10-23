# Notifications and alerts: in-app, Telegram, and agent-configured rules

Status: **planned, not built** (2026-10-23). Decisions taken by the product owner: one shared Telegram bot for now; alerts classified by us (section 4); the agent is Hermes, running inside each customer's account, with its skill and profile managed from the app; Tamil is in scope (section 7).

## 0. Status (2026-10-23)

**Built: phase 1 with the form and the sentence box (no Hermes).** The owner chose to build the form and the one-call assistant first; Hermes per customer (section 6) and Telegram delivery (section 5) are not built and are optional later layers over the same rules API.

- Migration `084_alerts.sql`: `alert_rule`, `notification`, `notification_state`, `notification_pref`; `alerts.manage` permission for the Business Head and Owner-operator.
- API `api-v2/src/modules/app/alerts/`: the engine (`alerts.service.ts`, each minute, plus "Check now"), five alert kinds (`alert-kinds.ts`: bank deposit due, store licence ending, pharmacist registration ending, shift left open, stock adjustments waiting), the English / Tamil message catalogue (`alert-messages.ts`), who sees what (`alert-access.ts`), and the assistant (`alert-drafter.ts`).
- Screens: the bell in the header and `/secure/notifications` (read, dismiss, snooze, language), and Settings > Alerts (rules, a form with a preview of what it would raise now, and the "Describe an alert" box).
- **The assistant** is one stateless call to the Anthropic Messages API with a forced tool call, only when `ANTHROPIC_API_KEY` is set (`ANTHROPIC_BASE_URL` and `ALERT_DRAFT_MODEL`, default `claude-haiku-5-5`, are optional). It only drafts: the model's output is validated against the kinds, limits, recipients and the business's own stores, shown with a preview, and saved only when the owner presses save (stored with the original sentence, source "assistant"). 20 drafts an hour per business. Not yet exercised against the live API (unit tests use a stub); the QA server has no key.
- **Differences from the plan below:** the preview shows what the rule would raise *now*, not the last 30 days (these are state alerts, so history is not stored); the near-expiry stock kind is not built (the stock balance query is per batch and store, and needs care); no Telegram per-person delivery yet; the Tamil text is a draft for a native speaker to review.
- Tests: `qa/specs/alerts.spec.ts` (ALRT-1 to 9) and `api-v2/src/modules/app/alerts/*.spec.ts`.

## 1. Principles

1. **The app owns the alert engine.** Conditions are evaluated by plain code (cheap, testable, explainable, no model call per event).
2. **Agents configure, they never evaluate.** An agent turns an instruction into a rule, previews it, and proposes it through a narrow API. A person approves anything that widens who sees what, or adds a Telegram recipient.
3. **In-app is the source of truth.** Telegram and the agent are delivery and configuration layers over the same notification list.
4. **A broken control plane or Telegram never blocks the shop.** In-app keeps working; Telegram delivery queues and retries.
5. **No customer or patient data in Telegram.** Counts, amounts, store names and a link back. Never customer names or prescription details.

## 2. Model

Two kinds of item:
- **State alert**: a condition that stays true until fixed and is recomputed (deposit due, licence expiring, shift left open, stock expiring, trial ending). It resolves itself when the condition clears and does not repeat while open.
- **Event notification**: something happened (approval requested, approval decided, disposal needs sign-off).

Each item: severity (info / warning / critical), store, code (the message key), parameters (for the template), link to the screen that fixes it, a de-duplication key (`deposit:store12:2026-10-26`), due time, resolved time.

Tables (migrations when built): `alert_rule` (kind, parameters, severity, scope, recipients, channels, schedule, source = system / person / agent, the original instruction text, created by), `notification` (the items), `notification_state` (per person: read, dismissed, snoozed until), `notification_delivery` (channel, status, attempts), `notification_pref` (per person: language, channels, quiet hours, lowest severity for push, instant vs digest).

Engine: evaluators registered per kind, run by the existing scheduler (`@nestjs/schedule`); each reads data the app already has (`GET /store-cash/deposit-status`, licence and registration expiry, shifts, expiry, approvals). Visibility follows role and store (Sales Staff and the shared Counter see only till and shift items) and the plan's modules (no alerts for a module the account lacks).

## 3. In-app

A bell in the header with an unread count and a notifications page (filter by severity, store, module); mark read, dismiss, snooze. The dashboard "needs attention" strip reads the same list. First version polls about once a minute.

## 4. Classification

| Tier | Alerts | Delivery |
|---|---|---|
| **Instant** (in-app + Telegram) | approval waiting for you; cash difference at shift close; bank deposit overdue; shift left open past its end; disposal or stock adjustment awaiting sign-off; failed backup; plan suspended; licence or pharmacist registration 7 days or less from lapsing; trial ends in 7 and in 1 day | to the person who must act; escalate to the owner after 24 h unactioned, then remind at an interval |
| **Daily digest** (Telegram once a day + in-app) | deposit due today; approvals older than a day; licences and registrations 30 and 60 days out; near-expiry stock; low stock; vendor payments due; unmatched digital payments; follow-ups due; warranties ending | one message per store per day (extends the existing digest) |
| **In-app only** | approval decided; reconciliation done; plan and limit notes; informational changes | bell and page |

Quiet hours defer instant items to the morning except critical ones. These are defaults; a rule can override its tier.

## 5. Telegram (shared bot)

- **The bot token lives only at the control plane.** A tenant app sends to the control plane (`POST /notify`, signed with the tenant secret); the control plane maps tenant and person to a chat and sends. Tenants never hold the token. If the control plane is down, items queue in the tenant and retry.
- **Linking:** in the app, "Link Telegram" shows a one-time code; the person sends it to the bot; the control plane stores (tenant, user, chat id). Unlink from the app or by blocking the bot.
- **Inbound:** one webhook at the control plane (webhook mode needs a secret), which routes by chat id to the tenant. Phase 1 is outbound only: messages carry a link to the app. No approving from inside Telegram until a signed, expiring action link is designed (approving is sensitive).
- **Limits and plan rules:** Telegram messages per day per plan; off for demos and trials; messages over 4,096 characters are split by Telegram's limit, so keep them short.
- **Per-person delivery**, not only the shared store chat, so "needs your approval" reaches the approver.

## 6. Hermes agent, per customer account (research findings and design)

### What Hermes gives us (from its docs; fast-moving, pin a version and re-verify)
- Open source (MIT), self-hosted. State is scoped by `HERMES_HOME`. A **profile** is a separate home at `~/.hermes/profiles/<name>/` holding `config.yaml` (model, toolsets), `.env` (keys, bot tokens), `SOUL.md` (the agent's role and instructions), memory, sessions, skills, cron jobs.
- A **skill** is a directory with a `SKILL.md` (YAML front matter plus instructions). Only name and description sit in the prompt; the body loads when the agent uses it. Skills also self-create and self-improve with use, which is a risk for a managed product (see below).
- **MCP:** servers are declared under `mcp_servers` in `config.yaml` (stdio or HTTP), with per-server tool filtering (`tools.include` / `exclude`) and `enabled: false` to switch one off.
- **API server:** an OpenAI-compatible endpoint (`API_SERVER_ENABLED`, `API_SERVER_KEY`, port 8642), so the app can send the agent a message and read the reply.
- **Gateway:** one process per profile; Telegram token and allowed user ids in `.env`; access is denied by default; long polling by default, webhook optional. A bot token cannot be shared by two running gateways (Telegram rejects concurrent polling; Hermes also locks the token per profile).
- **Docker:** an official image supervises one gateway per profile.
- **Profiles are not a sandbox.** On the local backend the agent has the host user's file access. Two processes must never share one profile home.

### The conflict with "one shared bot"
Hermes's own Telegram gateway needs its **own bot token per profile**. So one shared bot cannot be both the platform's alert sender and each customer's Hermes front end. Resolution:
- The **shared bot = platform alerts only** (section 5), sent by the control plane. Hermes is not involved in sending.
- Hermes talks to people **through the app** (an "Ask the assistant" panel that calls the profile's API server), not through the shared bot. A customer who wants Hermes in Telegram later brings its own bot token for its profile (optional, per-plan).

### Managed from the app
- **Provision:** the control plane (or tenant-up) creates one Hermes container per customer with its own volume; it writes `config.yaml`, `.env` and `SOUL.md` and installs our skill pack, rather than relying on the interactive setup (Hermes documents no fully non-interactive create flow; this is a gap to confirm).
- **Skill pack:** versioned by us (`skills/rgp-alerts/SKILL.md` and friends: how to write a rule, the rule schema, Tamil phrasing, what never to put in a message). The control plane pushes a new version to every profile. The app shows installed versions and lets an owner switch the agent off.
- **Profile settings in the app** (Settings > Assistant): on/off, language, the persona text appended to `SOUL.md`, which alert kinds the agent may configure, and the model and cost limit. Changes are written to the profile and the container reloads (`/reload-mcp` or restart).
- **Lock down:** run the agent in its container with only its own volume; disable shell and file toolsets in `config.yaml`; allow only our MCP server. Turn off or review skill self-creation so the agent cannot rewrite the managed skills (verify the setting exists).

### The boundary: a notifications MCP server in the app
The only tools the agent gets, scoped to one tenant by a narrow token and rate-limited:
`list_alert_kinds`, `list_rules`, `preview_rule` (what it would have fired on in the last 30 days), `propose_rule`, `propose_change`, `disable_rule`, `list_recent_notifications`, `suggest_tuning` (rules that fire often and are never acted on).
- Everything the agent proposes lands as **pending**; a person approves it in the app. Audit entry: "configured by the assistant at the request of [person]", with the original instruction.
- The agent sees structured fields only, never free text a user typed (product names, notes), to blunt prompt injection from data.
- Agent use counts against a plan limit (like invoice scans) and is a plan entitlement (`agent`).

### Hermes's own cron
Do not use it to evaluate alerts. It may write the daily digest summary and the weekly "tuning" suggestions.

### Research still open
Non-interactive profile creation and config; the exact API server endpoints and auth for a per-tenant container; resource use per tenant (memory per container); whether skill self-improvement can be disabled; behaviour on Tamil with the chosen model; pinning and upgrade path.

## 7. Tamil: scope

| Surface | In scope now | Notes |
|---|---|---|
| **Notification text** (in-app and Telegram) | yes | message catalogue keyed by code with parameters, `en` and `ta`; rendered by the server in the recipient's language; fallback to English. About 30 messages at launch. |
| **Per-person language** | yes | in the user's profile (`notification_pref.language`); the digest is sent per person's language |
| **Agent conversation** | yes | the skill pack carries Tamil phrasing; the model chosen must be tested on Tamil; voice notes need a speech-to-text that supports Tamil |
| **Numbers, dates, currency** | yes | en-IN / ta-IN formats, rupee symbol, lakh grouping; Tamil digits not used |
| **Whole app UI** | **no (separate project)** | Angular 12 with hard-coded English on every screen. Needs a runtime translation library (build-time Angular i18n makes one build per language) and extracting every string; large. Recommend after the notifications, screen by screen, starting with the POS counter. |
| **Printed documents** (invoices, registers) | no | need a Tamil font in the PDF and Excel tools if added later |

Translations are drafted by the agent or a translator and **reviewed by a native speaker** before release; machine output alone is not shipped. Telegram renders Tamil text natively.

## 8. Build order

1. **Model, bell and page, first sources** (deposit due, approvals pending, licence and registration expiry, shift left open, plan notices), English and Tamil catalogue, per-person language.
2. **Telegram:** control-plane relay, linking, per-person preferences, instant vs digest, quiet hours, escalation, plan limits.
3. **Rules API and notifications MCP server** with preview, pending approval and audit.
4. **Hermes per tenant:** container, profile and skill-pack provisioning, "Ask the assistant" panel through the API server, Settings > Assistant.
5. **Tuning suggestions and digest summaries.**
6. **Whole-app Tamil UI** (separate decision).

## 9. Open decisions

1. Hermes in Telegram for customers (own bot token) or only inside the app?
2. Which model runs the agent, and who pays for it (plan allowance vs the customer's own key)?
3. Which Tamil review route (a named person)?
4. Is the assistant a paid add-on or part of Chain only?
