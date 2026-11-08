import { BadRequestException, ForbiddenException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { isOwnerRole } from 'src/core/roles';
import { AiProvider, ProviderName, setStoredAiKey, storedAiKey } from './ai-provider';
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
  async test(user: any, model: string) {
    await this.owner(user);
    if (!this.ai.configured) throw new BadRequestException('There is no key yet.');
    if (!model) throw new BadRequestException('Choose a model first.');
    const out = await this.ai.call('You check that the connection works.', 'Reply with ok = true.', TEST_TOOL, model);
    return { ok: out?.ok === true };
  }
}
