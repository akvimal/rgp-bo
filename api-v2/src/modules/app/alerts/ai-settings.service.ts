import { BadRequestException, ForbiddenException, Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { isOwnerRole } from 'src/core/roles';
import { AiProvider, ProviderName, setAiUsageHooks, setStoredAiKey, storedAiKey } from './ai-provider';
import { AI_AREAS, areaOf, featureLabel, limitState, parseLimit, percent, UsageRecord, validLimit } from './ai-usage';
import { resolveModel } from './ai-models';
import { cleanKey, decryptKey, encryptKey, keyHint } from './ai-key';

const PROVIDERS: ProviderName[] = ['openrouter', 'anthropic'];
const TEST_TOOL = { name: 'reply', description: 'Reply to the check.', input_schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] } };

/** The assistant's key, saved in the app by the Business Head (never shown again, only its last characters). */
@Injectable()
export class AiSettingsService implements OnModuleInit {
  private readonly log = new Logger('AiSettings');
  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly ai: AiProvider, private readonly audit: AuditService) {}

  async onModuleInit() {
    try { await this.load(); } catch (e: any) { this.log.warn(`AI key not loaded: ${e?.message}`); }
    // every request any assistant makes is counted against the monthly limit and logged
    setAiUsageHooks({ before: () => this.beforeCall(), after: (r) => this.record(r) });
  }

  // ---------------------------------------------------------------- usage and the monthly limit
  private static readonly MONTH_START = `date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'`;

  private async limit(): Promise<number> {
    const [r] = await this.manager.query(`select setting_value from app_setting where setting_key = 'ai.monthly_limit' and active and not archive`);
    return r ? parseLimit(r.setting_value) : parseLimit(undefined);
  }

  private async usedThisMonth(): Promise<number> {
    const [r] = await this.manager.query(`select count(*)::int as n from ai_usage where used_on >= ${AiSettingsService.MONTH_START}`);
    return r?.n ?? 0;
  }

  private async beforeCall() {
    let limit = 0, used = 0;
    try { limit = await this.limit(); if (limit > 0) used = await this.usedThisMonth(); } catch (e: any) { this.log.warn(`AI limit not checked: ${e?.message}`); return; }
    if (limit > 0 && used >= limit) {
      throw new ServiceUnavailableException(`The assistant's limit of ${limit} requests for this month has been reached. The Business Head can raise it under Settings > AI assistant.`);
    }
  }

  private async record(r: UsageRecord) {
    try {
      await this.manager.query(
        `insert into ai_usage (provider, model, feature, ok, status, input_tokens, output_tokens, ms) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [r.provider, String(r.model || '').slice(0, 120), r.feature.slice(0, 60), r.ok, r.status, r.inputTokens, r.outputTokens, r.ms]);
    } catch (e: any) { this.log.warn(`AI usage not logged: ${e?.message}`); }
  }

  /** the month's use against the limit, and what it went on (for the Business Head's settings card) */
  async usage(user: any) {
    await this.owner(user);
    const limit = await this.limit();
    const rows = await this.manager.query(
      `select feature, count(*)::int as calls, count(*) filter (where not ok)::int as failed, coalesce(sum(input_tokens), 0)::int as input_tokens, coalesce(sum(output_tokens), 0)::int as output_tokens
         from ai_usage where used_on >= ${AiSettingsService.MONTH_START} group by feature order by calls desc`);
    const [last] = await this.manager.query(
      `select count(*)::int as n from ai_usage where used_on >= ${AiSettingsService.MONTH_START} - interval '1 month' and used_on < ${AiSettingsService.MONTH_START}`);
    const used = rows.reduce((n: number, r: any) => n + r.calls, 0);
    const [m] = await this.manager.query(`select to_char(now() at time zone 'Asia/Kolkata', 'YYYY-MM') as month`);
    return {
      month: m.month, limit, used, state: limitState(used, limit), last_month: last?.n ?? 0,
      by_feature: rows.map((r: any) => ({ ...r, label: featureLabel(r.feature) })),
    };
  }

  /**
   * Where the assistant is used and how much: every area of the app that asks a model for something (also those never used yet), this month against last
   * month, failures, how long a request takes, tokens, which models served it, and a day-by-day count for the last 30 days. Numbers only, never any text.
   */
  async report(user: any) {
    await this.owner(user);
    const MS = AiSettingsService.MONTH_START;
    const rows = await this.manager.query(
      `select feature,
              count(*) filter (where used_on >= ${MS})::int as month,
              count(*) filter (where used_on >= ${MS} - interval '1 month' and used_on < ${MS})::int as last_month,
              count(*)::int as total,
              count(*) filter (where used_on >= ${MS} and not ok)::int as failed,
              coalesce(round(avg(ms) filter (where used_on >= ${MS})), 0)::int as avg_ms,
              coalesce(sum(input_tokens) filter (where used_on >= ${MS}), 0)::int as input_tokens,
              coalesce(sum(output_tokens) filter (where used_on >= ${MS}), 0)::int as output_tokens,
              to_char(max(used_on) at time zone 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI') as last_used,
              array_remove(array_agg(distinct model) filter (where used_on >= ${MS}), '') as models
         from ai_usage group by feature`);
    const features = [...AI_AREAS.map((a) => a.feature), ...rows.map((r: any) => r.feature).filter((f: string) => !AI_AREAS.some((a) => a.feature === f))];
    const areas = features.map((f) => {
      const r = rows.find((x: any) => x.feature === f);
      const a = areaOf(f);
      return {
        feature: f, label: a.label, what: a.what, where: a.where, route: a.route,
        month: r?.month ?? 0, last_month: r?.last_month ?? 0, total: r?.total ?? 0, failed: r?.failed ?? 0, failed_pct: percent(r?.failed ?? 0, r?.month ?? 0),
        avg_ms: r?.avg_ms ?? 0, input_tokens: r?.input_tokens ?? 0, output_tokens: r?.output_tokens ?? 0, last_used: r?.last_used ?? null, models: r?.models ?? [],
      };
    }).sort((a, b) => b.month - a.month || b.total - a.total || a.label.localeCompare(b.label));
    const daily = await this.manager.query(
      `select to_char(g.d, 'YYYY-MM-DD') as day, coalesce(c.calls, 0)::int as calls, coalesce(c.failed, 0)::int as failed
         from generate_series((now() at time zone 'Asia/Kolkata')::date - 29, (now() at time zone 'Asia/Kolkata')::date, interval '1 day') g(d)
         left join (select (used_on at time zone 'Asia/Kolkata')::date as day, count(*) as calls, count(*) filter (where not ok) as failed from ai_usage
                     where used_on >= now() - interval '32 days' group by 1) c on c.day = g.d::date order by g.d`);
    const byModel = await this.manager.query(
      `select coalesce(nullif(model, ''), 'unknown') as model, count(*)::int as calls, count(*) filter (where not ok)::int as failed,
              coalesce(sum(input_tokens), 0)::int as input_tokens, coalesce(sum(output_tokens), 0)::int as output_tokens
         from ai_usage where used_on >= ${MS} group by 1 order by calls desc`);
    const month = areas.reduce((n, a) => n + a.month, 0);
    const failed = areas.reduce((n, a) => n + a.failed, 0);
    const [t] = await this.manager.query(`select coalesce(round(avg(ms)), 0)::int as avg_ms from ai_usage where used_on >= ${MS}`);
    const limit = await this.limit();
    return {
      limit, used: month, state: limitState(month, limit), failed, success_pct: percent(month - failed, month), avg_ms: t?.avg_ms ?? 0,
      input_tokens: areas.reduce((n, a) => n + a.input_tokens, 0), output_tokens: areas.reduce((n, a) => n + a.output_tokens, 0),
      busiest: month ? areas[0].label : null, areas, daily, by_model: byModel, never_used: areas.filter((a) => !a.total).length,
    };
  }

  /** the models were changed (the choices themselves are in the settings rows) */
  async recordModels(user: any, count: number, changes: any) {
    await this.audit.record({ userId: user.id, action: 'ai.models_set', summary: `assistant models changed (${count} choice${count === 1 ? '' : 's'})`, details: { changes } });
  }

  async saveLimit(user: any, body: any) {
    await this.owner(user);
    const n = validLimit(body?.limit);
    if (n === null) throw new BadRequestException('Give the limit as a whole number of requests a month (0 means no limit).');
    await this.put('ai.monthly_limit', String(n), user.id);
    await this.audit.record({ userId: user.id, action: 'ai.limit_set', summary: `assistant limit set to ${n === 0 ? 'no limit' : n + ' requests a month'}`, details: { limit: n } });
    return this.usage(user);
  }

  async load() {
    const rows = await this.manager.query(`select setting_key, setting_value from app_setting where setting_key in ('ai.key', 'ai.provider') and active and not archive`);
    const key = decryptKey(rows.find((r: any) => r.setting_key === 'ai.key')?.setting_value);
    const provider = rows.find((r: any) => r.setting_key === 'ai.provider')?.setting_value as ProviderName;
    setStoredAiKey(key && PROVIDERS.includes(provider) ? { provider, key } : null);
  }

  private async owner(user: any) {
    const [r] = await this.manager.query(`select r.name from app_user u join app_role r on r.id = u.role_id where u.id = $1`, [user?.id || 0]);
    if (!isOwnerRole(r?.name)) throw new ForbiddenException('Only the Business Head can set the assistant\'s key.');
  }

  /** what the settings page shows about the key */
  state() {
    const s = storedAiKey();
    return { keySource: this.ai.keySource, keyProvider: s?.provider ?? null, keyHint: s ? keyHint(s.key) : null, off: process.env.AI_PROVIDER === 'off' };
  }

  private async put(key: string, value: string, by: number) {
    await this.manager.query(
      `insert into app_setting (category, setting_key, setting_value, created_by, updated_by) values ('ai', $1, $2, $3, $3)
       on conflict (setting_key) do update set setting_value = excluded.setting_value, active = true, archive = false, updated_on = now(), updated_by = excluded.updated_by`, [key, value, by]);
  }

  async save(user: any, body: any) {
    await this.owner(user);
    const provider = String(body?.provider || '') as ProviderName;
    if (!PROVIDERS.includes(provider)) throw new BadRequestException('Choose OpenRouter or Anthropic.');
    const key = cleanKey(body?.key);
    if (!key) throw new BadRequestException('Paste the whole key (no spaces).');
    await this.put('ai.provider', provider, user.id);
    await this.put('ai.key', encryptKey(key), user.id);
    setStoredAiKey({ provider, key });
    await this.audit.record({ userId: user.id, action: 'ai.key_saved', summary: `assistant key saved (${provider})`, details: { provider } });
    return this.state();
  }

  async clear(user: any) {
    await this.owner(user);
    await this.manager.query(`update app_setting set active = false, archive = true, setting_value = null, updated_on = now() where setting_key in ('ai.key', 'ai.provider')`);
    setStoredAiKey(null);
    await this.audit.record({ userId: user.id, action: 'ai.key_cleared', summary: 'assistant key removed', details: {} });
    return this.state();
  }

  /** one small request, to see that the key and the model work */
  async test(user: any) {
    await this.owner(user);
    if (!this.ai.configured) throw new BadRequestException('There is no key yet.');
    const model = await resolveModel(this.manager, this.ai, 'reply');
    if (!model) throw new BadRequestException('Choose a model first.');
    const out = await this.ai.call('You check that the connection works.', 'Reply with ok = true.', TEST_TOOL, model);
    return { ok: out?.ok === true };
  }
}
