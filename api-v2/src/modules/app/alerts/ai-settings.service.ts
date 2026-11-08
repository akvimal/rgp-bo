import { BadRequestException, ForbiddenException, Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { isOwnerRole } from 'src/core/roles';
import { AiProvider, ProviderName, setAiUsageHooks, setStoredAiKey, storedAiKey } from './ai-provider';
import { featureLabel, limitState, parseLimit, UsageRecord, validLimit } from './ai-usage';
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
