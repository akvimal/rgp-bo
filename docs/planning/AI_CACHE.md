# Fewer AI requests: a cache and refresh limits

Status: designed 2026-11-09; **phase 1 built (uncommitted)**. Phases 2 and 3 not built.

## Problem

Every request to the assistant is counted against one monthly limit (default 300, `ai-settings.service.ts`), but nothing stops the same request being made again and again:

- **Buying brief**: every click on the Reorder screen is a new request, though the list has not changed.
- **Ask the shop**: the same question typed twice is two requests.
- **Coaching note**: every "Write it again" is a request, and the draft **overwrites the manager's edits and takes the note back to unshared** (`on conflict ... do update`). That is a data-loss bug as much as a cost one.
- **Weekly summary**: made once a week (already), but `force` can regenerate it any number of times.
- The role, KPI, band, follow-up wording, alert-rule and checklist drafts have no memory of the last answer.

## Design

**One layer at the one choke point.** `AiCacheService.run(...)` (`alerts/ai-cache.service.ts`) wraps the call to the model. It keeps the *model's answer* (not the whole response, so figures that cost nothing to compute are always fresh) under a **fingerprint** of what the answer was based on. The same fingerprint within the lifetime returns the stored answer and makes no request; a hit is logged and does not count against the monthly limit.

**A fingerprint chosen per feature, not a hash of the prompt.** The buying brief's prompt carries "days of stock left", which changes every day; hashing it would defeat "keep it until new purchase data is added".

**A policy per feature** (`ai-cache-rules.ts`, pure and tested): how long an answer lives, how many refreshes are allowed in a period, whether a refresh is allowed when nothing has changed, and a cap on new requests per person. A refused request answers 429 with the reason and when it may be tried again.

**Rules**
- A refresh when the fingerprint is unchanged is refused ("nothing new since it was written") for the features where wording would not change; the Refresh button then shows why and is disabled.
- A failed request is never cached and takes nothing from the refresh allowance.
- If the cache tables are missing (migration not run), the request goes through as before.
- The cache holds answers only; prompts already leave out staff names and numbers.

## Phase 1 (built)

Migration `178_ai_cache.sql`: `ai_result_cache` (feature, scope, fingerprint, output, expiry, hits) and `ai_cache_event` (HIT, MISS, REFRESH, REFUSED per feature, scope and person: the refresh counts, and later the usage figures).

| Feature | Fingerprint (what it is kept until) | Limits |
|---|---|---|
| **Buying brief** | the set of products to reorder and the set at risk, plus the newest verified purchase line at the stores in scope: a new purchase or a new product on the list makes a new brief; stock sold down does not. 3 day cap. | refresh 2 a day per scope; refused when unchanged |
| **Ask the shop** | the question (lower case, spaces and end punctuation ignored), the day (so "last week" means the right week) and the role | 20 new requests an hour per person |
| **Coaching note** | the person's figures for the period. Unchanged figures return the saved note with **no request**. | rewrite 3 a month per person and period; **an edited or shared note is not overwritten without a confirmation** |
| **Weekly summary** | the week's figures; the Monday timer is untouched | "make it again" once a day |

Screens: the buying brief shows when it was written and whether it is from the earlier one, with the refreshes left; the coaching screen asks before replacing an edited or shared note; refusals show the reason.

## Checked (phase 1)

- 13 unit tests of the rules (`ai-cache-rules.spec.ts`: fingerprints, what a brief is kept until, serve / call / refuse, limits and when the next is allowed, the off switch, and that the migration allows exactly the event kinds the code uses); the rest of the backend suites around it pass.
- Migration `178` applied, rolled back and applied again. It also adds the setting `ai.cache_mode` (`on`; `off` asks the assistant every time as before, and is the Business Head's escape hatch).
- Playwright `ai-cache.spec.ts` against the stand-in model, which now counts requests per tool so a test can prove none was made: **AIC-1** the brief is kept when only quantities change, a refresh of unchanged facts is refused with the reason, a new product or a new verified purchase makes a new brief; **AIC-2** a question typed differently is answered once, and a store head is stopped at twenty new requests an hour while kept answers are still served; **AIC-3** unchanged figures return the note with no request, an edited or shared note is not replaced without a confirmation and nothing is lost by a refused rewrite, confirmed rewrites stop at three a month; **AIC-4** the summary is made again at most once a day; **AIC-5** with the cache off every request goes through; **AIC-6** on the screens (real clicks): the coaching confirmation, and the brief's "written ... kept" note with Refresh disabled and why. The event log showed HIT, MISS, REFRESH and REFUSED for all four features.
- The existing `insights.spec.ts` passes (9 of 9). INS-8 was updated on purpose: it asserted that writing a shared note again silently un-shared it, which is the behaviour this change replaces with a confirmation. Those specs run with the cache off so they keep asking every time and are not stopped by the daily limits when run again.

### Behaviour worth knowing
- The coaching rewrite limit counts only requests that reach the assistant. A person and month with no figures at all get a plain-words note and no request is made, so there is nothing to limit.
- A failed request is not cached and does not use up a refresh.
- The refresh limits are per scope (the stores in scope, a person and month, a week); the cap on new questions is per person.

## Not built

- **Phase 2**: the same layer for the role, KPI, band, follow-up wording, alert-rule and checklist drafts (same inputs for 24 hours, about 10 a day per person), and for invoice extraction and pack-text checks by the **file's hash** when those are built.
- **Phase 3**: the usage card (calls, answers kept, refusals per feature) and a monthly budget per feature so one chatty feature cannot use the whole limit. The event table already records what is needed.
- Who may refresh: today whoever may use the feature; an owner-only refresh is a one-line policy change.

## Open question

The default limits (brief 2 a day, questions 20 an hour, rewrites 3 a month, summary once a day) are guesses. The usage log (Settings > AI assistant) should be read first and the limits set from what is really used.
