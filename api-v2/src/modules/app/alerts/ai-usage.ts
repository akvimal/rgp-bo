/** Pure helpers for the assistant's usage log and monthly limit. */

export interface UsageRecord {
  provider: string | null;
  model: string;
  feature: string;
  ok: boolean;
  status: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  ms: number;
}

/** what the app calls each kind of request, by the tool the model is made to call */
export const FEATURE_LABELS: Record<string, string> = {
  propose_alert_rule: 'Alert drafts',
  propose_checklist_items: 'Checklist suggestions',
  propose_role: 'Job role drafts',
  propose_kpis: 'KPI drafts',
  propose_bands: 'Incentive band drafts',
  draft_followup_messages: 'Follow-up messages',
  write_buying_brief: 'Buying briefs',
  answer_question: 'Shop questions',
  write_weekly_summary: 'Weekly owner summary',
  write_coaching_note: 'Staff coaching notes',
  reply: 'Connection tests',
};

export const featureLabel = (feature: string): string => FEATURE_LABELS[feature] || feature;

/** every place in the app that asks the model for something: what it does and where a person finds it (shown even before it is first used) */
export interface AreaInfo { feature: string; label: string; what: string; where: string; route: string }
export const AI_AREAS: AreaInfo[] = [
  { feature: 'propose_alert_rule', label: 'Alert drafts', what: 'Turns a sentence such as "tell the store heads when a shift stays open 12 hours" into an alert rule to review.', where: 'Settings > Alerts, Describe an alert', route: '/secure/settings/alerts' },
  { feature: 'propose_checklist_items', label: 'Checklist suggestions', what: 'Suggests opening and closing checklist items from the last 30 days or from a description of the shop.', where: 'Settings > Store, Checklists', route: '/secure/settings/store' },
  { feature: 'propose_role', label: 'Job role drafts', what: 'Drafts a job role description from a position and what the person does.', where: 'HR > Role assistant', route: '/secure/hr' },
  { feature: 'propose_kpis', label: 'KPI drafts', what: 'Chooses measures, rules and targets for a role from the shop history.', where: 'HR > Role assistant', route: '/secure/hr' },
  { feature: 'propose_bands', label: 'Incentive band drafts', what: 'Proposes incentive amounts for performance bands of a role.', where: 'HR > Role assistant', route: '/secure/hr' },
  { feature: 'draft_followup_messages', label: 'Follow-up messages', what: 'Writes the wording of the reminder messages staff send to customers who are due back, lapsed, new or owe money, in English and Tamil.', where: 'Customers > Contact today, Message wording', route: '/secure/customers/cust/worklist' },
  { feature: 'write_buying_brief', label: 'Buying briefs', what: 'Reads the reorder list and the stock that will not sell in time, and says what to buy first and what to clear.', where: 'Purchases > Reorder, Buying brief', route: '/secure/purchases/suggestions' },
  { feature: 'answer_question', label: 'Shop questions', what: 'Understands a question typed in plain words and picks the right report and period. The answer is worked out here, never by the model.', where: 'Reports > Ask the shop', route: '/secure/reports/ask' },
  { feature: 'write_weekly_summary', label: 'Weekly owner summary', what: 'Writes the short Monday summary of last week from the shop figures.', where: 'Reports > Weekly summary', route: '/secure/reports/weekly' },
  { feature: 'write_coaching_note', label: 'Staff coaching notes', what: 'Writes a note for a manager to talk through with a person: what went well, where to focus, a tip for each.', where: 'HR > Coaching', route: '/secure/hr' },
  { feature: 'reply', label: 'Connection tests', what: 'One small request to check that the key and model work.', where: 'Settings > AI assistant, Test', route: '/secure/settings/business-profile/ai' },
];
export const areaOf = (feature: string): AreaInfo => AI_AREAS.find((a) => a.feature === feature) || { feature, label: featureLabel(feature), what: '', where: '', route: '' };

/** a share as a whole percentage; none when there is nothing to divide */
export const percent = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 100) : null);

export const DEFAULT_MONTHLY_LIMIT = 300;
export const MAX_MONTHLY_LIMIT = 100000;

/** the limit as stored: a whole number from 0 (no limit) up; anything else falls back to the default */
export function parseLimit(raw: unknown): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= MAX_MONTHLY_LIMIT ? n : DEFAULT_MONTHLY_LIMIT;
}

/** a limit a person types: refused unless it is a whole number in range */
export function validLimit(raw: unknown): number | null {
  if (raw === '' || raw === null || raw === undefined) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= MAX_MONTHLY_LIMIT ? n : null;
}

export type LimitState = 'ok' | 'near' | 'reached' | 'none';

/** where the month stands against the limit: near from 80% */
export function limitState(used: number, limit: number): LimitState {
  if (limit <= 0) return 'none';
  if (used >= limit) return 'reached';
  return used >= Math.ceil(limit * 0.8) ? 'near' : 'ok';
}

const whole = (v: any): number | null => (Number.isFinite(Number(v)) && v !== null && v !== undefined ? Math.max(0, Math.round(Number(v))) : null);

/** the tokens a reply says it used (Anthropic names them input/output, OpenRouter prompt/completion) */
export function tokensOf(provider: string, body: any): { input: number | null; output: number | null } {
  const u = body?.usage;
  if (!u) return { input: null, output: null };
  return provider === 'anthropic' ? { input: whole(u.input_tokens), output: whole(u.output_tokens) } : { input: whole(u.prompt_tokens), output: whole(u.completion_tokens) };
}

/** the hooks the provider calls: one before a request (may refuse) and one after (never throws) */
export interface AiUsageHooks {
  before(): Promise<void>;
  after(r: UsageRecord): void | Promise<void>;
}
