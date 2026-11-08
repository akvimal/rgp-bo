import { BadRequestException, ForbiddenException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuditService } from 'src/core/audit/audit.service';
import { isManagerRole } from 'src/core/roles';
import { AiProvider } from '../alerts/ai-provider';
import { resolveModel } from '../alerts/ai-models';
import { AUDIENCE_LABELS, FOLLOWUP_AUDIENCES, FOLLOWUP_LANGS, Templates, cleanDraft, cleanTemplate, mergeTemplates } from './customer-followup-rules';

const KEY = 'followup.templates';

const TOOL = {
  name: 'draft_followup_messages',
  description: 'Write the follow-up messages a shop sends to its customers, in English and Tamil.',
  input_schema: {
    type: 'object',
    properties: {
      messages: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            audience: { type: 'string', enum: [...FOLLOWUP_AUDIENCES] },
            en: { type: 'string', description: 'The message in English: two sentences at most.' },
            ta: { type: 'string', description: 'The same message in natural spoken Tamil, written in Tamil script.' },
          },
          required: ['audience', 'en', 'ta'],
        },
      },
    },
    required: ['messages'],
  },
};

/** The wording of the messages staff send from the contact list: kept in app_setting, with a first version written by the assistant when it is on. */
@Injectable()
export class CustomerFollowupService {
  private readonly log = new Logger(CustomerFollowupService.name);

  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly ai: AiProvider, private readonly audit: AuditService) {}

  private async store(): Promise<string> {
    const [b] = await this.manager.query(`select name from business where active and not archive order by id limit 1`);
    return String(b?.name || 'our shop').trim();
  }

  private async saved(): Promise<any> {
    const [s] = await this.manager.query(`select setting_value from app_setting where setting_key = $1 and active and not archive`, [KEY]);
    try { return s?.setting_value ? JSON.parse(s.setting_value) : null; } catch { return null; }
  }

  private async manager_(user: any) {
    const [r] = await this.manager.query(`select name from app_role where id = $1`, [user?.roleid || 0]);
    if (!isManagerRole(r?.name)) throw new ForbiddenException('Only the Business Head and Store Heads can change the message wording.');
  }

  private async put(templates: Templates, userId: number) {
    await this.manager.query(
      `insert into app_setting (category, setting_key, setting_value, description, created_by, updated_by) values ('customers', $1, $2, 'Follow-up message wording (English and Tamil)', $3, $3)
       on conflict (setting_key) do update set setting_value = excluded.setting_value, active = true, archive = false, updated_on = now(), updated_by = excluded.updated_by`, [KEY, JSON.stringify(templates), userId]);
  }

  async templates() {
    const saved = await this.saved();
    return { store: await this.store(), audiences: FOLLOWUP_AUDIENCES.map((a) => ({ key: a, label: AUDIENCE_LABELS[a] })), languages: FOLLOWUP_LANGS, templates: mergeTemplates(saved), custom: !!saved };
  }

  async save(user: any, body: any) {
    await this.manager_(user);
    for (const a of FOLLOWUP_AUDIENCES) for (const l of FOLLOWUP_LANGS) {
      const raw = body?.templates?.[a]?.[l];
      if (raw !== undefined && !cleanTemplate(raw)) throw new BadRequestException(`The ${AUDIENCE_LABELS[a]} message in ${l === 'en' ? 'English' : 'Tamil'} must greet the customer with {name} and be a full sentence.`);
      if (a === 'dues' && raw !== undefined && !String(raw).includes('{amount}')) throw new BadRequestException('The unpaid dues message must say how much is owed: put {amount} in it.');
    }
    await this.put(mergeTemplates(body?.templates), user.id);
    await this.audit.record({ userId: user.id, action: 'customers.followup_wording', summary: 'follow-up message wording saved', details: {} });
    return this.templates();
  }

  async reset(user: any) {
    await this.manager_(user);
    await this.manager.query(`update app_setting set active = false, archive = true, setting_value = null, updated_on = now() where setting_key = $1`, [KEY]);
    await this.audit.record({ userId: user.id, action: 'customers.followup_wording', summary: 'follow-up message wording reset to the standard', details: { reset: true } });
    return this.templates();
  }

  /** a first version from the assistant: returned for the person to read and edit, not saved */
  async draft(user: any) {
    await this.manager_(user);
    if (!this.ai.configured) throw new ServiceUnavailableException('The assistant is not switched on. The Business Head can add its key under Settings > AI assistant.');
    const model = await resolveModel(this.manager, this.ai, 'draft_followup_messages');
    if (!model) throw new ServiceUnavailableException('Choose the assistant\'s model under Settings > AI assistant first.');
    const [b] = await this.manager.query(`select business_type from business where active and not archive order by id limit 1`);
    const out = await this.ai.call(
      `You write the short reminder messages a small Indian ${b?.business_type || 'pharmacy'} sends to its customers on WhatsApp, in English and in Tamil.
Warm, respectful and brief: two sentences at most. No emojis, no offers, no pressure. Never mention a medicine, a condition or a diagnosis. Always greet with {name}; you may use {store} for the shop's name; the unpaid dues message must use {amount}.
Always answer by calling the tool, with one message for each of the four audiences.`,
      `Audiences:\n${FOLLOWUP_AUDIENCES.map((a) => `- ${a}: ${AUDIENCE_LABELS[a]}`).join('\n')}`, TOOL, model, 1400);
    const d = cleanDraft(out);
    if (!d.changed) throw new BadRequestException('The assistant did not return usable wording. Try again, or write the messages yourself.');
    await this.audit.record({ userId: user.id, action: 'customers.followup_drafted', summary: 'the assistant drafted follow-up message wording', details: { messages: d.changed } });
    return { store: await this.store(), templates: d.templates, changed: d.changed };
  }
}
