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
  reply: 'Connection tests',
};

export const featureLabel = (feature: string): string => FEATURE_LABELS[feature] || feature;

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
