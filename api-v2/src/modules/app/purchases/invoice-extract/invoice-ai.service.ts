import { Injectable, Logger } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AiImage, AiProvider } from '../../alerts/ai-provider';
import { resolveModel } from '../../alerts/ai-models';
import { AiCacheService } from '../../alerts/ai-cache.service';
import { fingerprint } from '../../alerts/ai-cache-rules';
import { AiRead, InvoiceReadMode, PROMPT_VERSION, READ_INVOICE_TOOL, SYSTEM_PROMPT, fromAi, parseMode, pictureInstruction, textInstruction } from './invoice-ai';

export interface AiStatus {
  mode: InvoiceReadMode;
  /** the assistant is switched on for invoices, has a key and a model */
  ready: boolean;
  model: string | null;
  /** the model can read pictures: true, false, or null when that is not known */
  vision: boolean | null;
}

export interface AiStep { read: AiRead | null; model: string; fromCache: boolean }

const MAX_TOKENS = 6000;

/**
 * Reads a scanned invoice with the assistant: first the words the plain reader found (cheap), then, if the setting allows it, the pictures of the pages.
 * What the model says is kept per file, so attaching the same copy again costs nothing. The caller checks every result against the invoice's own total.
 */
@Injectable()
export class InvoiceAiService {
  private readonly log = new Logger(InvoiceAiService.name);

  constructor(@InjectEntityManager() private readonly manager: EntityManager, private readonly ai: AiProvider, private readonly cache: AiCacheService) {}

  async mode(): Promise<InvoiceReadMode> {
    const [s] = await this.manager.query(`select setting_value from app_setting where setting_key = 'ai.invoice_read' and active and not archive`).catch(() => [null]);
    return parseMode(s?.setting_value);
  }

  async setMode(mode: InvoiceReadMode, userId: number) {
    await this.manager.query(
      `insert into app_setting (category, setting_key, setting_value, created_by, updated_by) values ('ai', 'ai.invoice_read', $1, $2, $2)
       on conflict (setting_key) do update set setting_value = excluded.setting_value, active = true, archive = false, updated_on = now(), updated_by = excluded.updated_by`, [mode, userId]);
  }

  async status(): Promise<AiStatus> {
    const mode = await this.mode();
    if (mode === 'off' || !this.ai.configured) return { mode, ready: false, model: null, vision: null };
    const model = (await resolveModel(this.manager, this.ai, 'read_invoice')) || null;
    if (!model) return { mode, ready: false, model: null, vision: null };
    let vision: boolean | null = null;
    try { vision = (await this.ai.models()).find((m) => m.id === model)?.vision ?? null; } catch { /* not known */ }
    return { mode, ready: true, model, vision };
  }

  private async run(step: 'text' | 'image', fileHash: string, model: string, userId: number | null, produce: () => Promise<any>): Promise<AiStep> {
    const done = await this.cache.run({
      feature: 'read_invoice', scope: `invoice:${fileHash}`, fingerprint: fingerprint({ step, model, prompt: PROMPT_VERSION }), userId, what: 'invoice reading', model,
    }, produce);
    return { read: fromAi(done.value), model, fromCache: done.fromCache };
  }

  /** the words of the copy (as the plain reader found them) sent to the model */
  async readText(text: string, ownGstin: string | null, fileHash: string, model: string, userId: number | null): Promise<AiStep> {
    return this.run('text', fileHash, model, userId, async () => (await this.ai.call(SYSTEM_PROMPT, textInstruction(text, ownGstin), READ_INVOICE_TOOL, model, MAX_TOKENS)) ?? null);
  }

  /** the pages of the copy as pictures sent to the model */
  async readPictures(pictures: AiImage[], ownGstin: string | null, fileHash: string, model: string, userId: number | null): Promise<AiStep> {
    return this.run('image', fileHash, model, userId, async () => (await this.ai.call(SYSTEM_PROMPT, pictureInstruction(pictures.length, ownGstin), READ_INVOICE_TOOL, model, MAX_TOKENS, pictures)) ?? null);
  }
}
