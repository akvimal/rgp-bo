import { EntityManager } from 'typeorm';

/**
 * Which model does which job. The Business Head chooses a default model, may give a model to each level of difficulty ("Simple", "Standard",
 * "Complex"), and may give a model to a single assistant. A job uses the first of: its own model, its level's model, the default.
 *
 * Kept in app_setting: ai.model (the default), ai.model.tier.<tier>, ai.model.task.<task>. A task is named by the tool the model is made to call,
 * the same name the usage log uses.
 */
export type Tier = 'simple' | 'standard' | 'complex';

export interface TaskInfo { task: string; label: string; tier: Tier; }
export interface TierInfo { tier: Tier; label: string; hint: string; }

export const TIERS: TierInfo[] = [
  { tier: 'simple', label: 'Simple', hint: 'Short wording jobs: a sentence turned into an alert, a checklist worded. A small, cheap model is enough.' },
  { tier: 'standard', label: 'Standard', hint: 'Drafting a job role or incentive amounts from a few facts. A mid-size model does well.' },
  { tier: 'complex', label: 'Complex', hint: 'Choosing measures, rules and targets from your own history. Worth the most capable model.' },
];

export const TASKS: TaskInfo[] = [
  { task: 'propose_alert_rule', label: 'Alert drafts', tier: 'simple' },
  { task: 'propose_checklist_items', label: 'Checklist suggestions', tier: 'simple' },
  { task: 'reply', label: 'Connection test', tier: 'simple' },
  { task: 'propose_role', label: 'Job role drafts', tier: 'standard' },
  { task: 'propose_bands', label: 'Incentive band drafts', tier: 'standard' },
  { task: 'draft_followup_messages', label: 'Follow-up messages', tier: 'simple' },
  { task: 'write_buying_brief', label: 'Buying briefs', tier: 'simple' },
  { task: 'answer_question', label: 'Shop questions', tier: 'standard' },
  { task: 'write_weekly_summary', label: 'Weekly owner summary', tier: 'standard' },
  { task: 'write_coaching_note', label: 'Staff coaching notes', tier: 'standard' },
  { task: 'propose_kpis', label: 'KPI drafts', tier: 'complex' },
  { task: 'read_invoice', label: 'Invoice reading', tier: 'complex' },
];

export const DEFAULT_KEY = 'ai.model';
export const tierKey = (t: Tier) => `ai.model.tier.${t}`;
export const taskKey = (task: string) => `ai.model.task.${task}`;

export const isTier = (v: string): v is Tier => TIERS.some((t) => t.tier === v);
export const taskInfo = (task: string): TaskInfo | undefined => TASKS.find((t) => t.task === task);

export interface ModelChoices {
  default: string;
  tiers: Partial<Record<Tier, string>>;
  tasks: Record<string, string>;
}

export type ModelSource = 'task' | 'tier' | 'default' | 'server';

/** the model a job uses, and why */
export function pickModel(c: ModelChoices, task: string, serverDefault: string): { model: string; source: ModelSource } {
  const own = c.tasks[task];
  if (own) return { model: own, source: 'task' };
  const info = taskInfo(task);
  const level = info ? c.tiers[info.tier] : undefined;
  if (level) return { model: level, source: 'tier' };
  if (c.default) return { model: c.default, source: 'default' };
  return { model: serverDefault, source: 'server' };
}

/** the choices as stored: any setting row that is switched off, or empty, is no choice */
export function choicesFrom(rows: { setting_key: string; setting_value: string | null }[]): ModelChoices {
  const c: ModelChoices = { default: '', tiers: {}, tasks: {} };
  for (const r of rows) {
    const v = String(r.setting_value || '').trim();
    if (!v) continue;
    if (r.setting_key === DEFAULT_KEY) c.default = v;
    else if (r.setting_key.startsWith('ai.model.tier.')) { const t = r.setting_key.slice('ai.model.tier.'.length); if (isTier(t)) c.tiers[t] = v; }
    else if (r.setting_key.startsWith('ai.model.task.')) { const t = r.setting_key.slice('ai.model.task.'.length); if (taskInfo(t)) c.tasks[t] = v; }
  }
  return c;
}

export async function loadChoices(manager: EntityManager): Promise<ModelChoices> {
  const rows = await manager.query(`select setting_key, setting_value from app_setting where setting_key like 'ai.model%' and active and not archive`);
  return choicesFrom(rows);
}

/** the model for a job: used by every assistant */
export async function resolveModel(manager: EntityManager, ai: { defaultModel: string }, task: string): Promise<string> {
  return pickModel(await loadChoices(manager), task, ai.defaultModel).model;
}

/** what a save asks for, checked for shape only (whether each model may be chosen is checked against the provider's list) */
export interface ModelChanges {
  default?: string;
  tiers: Partial<Record<Tier, string>>;
  tasks: Record<string, string>;
}

export function parseChanges(body: any): { changes: ModelChanges } | { error: string } {
  const changes: ModelChanges = { tiers: {}, tasks: {} };
  const clean = (v: any): string | null => (typeof v === 'string' && v.length <= 120 && !/\s/.test(v.trim()) ? v.trim() : null);
  if (body?.default !== undefined) {
    const v = clean(body.default);
    if (v === null) return { error: 'The default model must be a model name.' };
    changes.default = v;
  }
  for (const [k, raw] of Object.entries(body?.tiers || {})) {
    if (!isTier(k)) return { error: `"${k}" is not a level of difficulty.` };
    const v = clean(raw);
    if (v === null) return { error: `The model for ${k} must be a model name, or empty.` };
    changes.tiers[k] = v;
  }
  for (const [k, raw] of Object.entries(body?.tasks || {})) {
    if (!taskInfo(k)) return { error: `"${k}" is not one of the assistants.` };
    const v = clean(raw);
    if (v === null) return { error: `The model for ${k} must be a model name, or empty.` };
    changes.tasks[k] = v;
  }
  return { changes };
}
