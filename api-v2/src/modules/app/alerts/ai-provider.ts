import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AiUsageHooks, tokensOf, UsageRecord } from './ai-usage';

export type ProviderName = 'openrouter' | 'anthropic';

export interface ModelInfo { id: string; name: string; context: number | null; promptPer1M: number | null; completionPer1M: number | null; /** can read pictures: true, false, or null when not known */ vision?: boolean | null; }

/** a picture sent with a request (for example one page of an invoice), as base64 */
export interface AiImage { mediaType: 'image/jpeg' | 'image/png'; base64: string; }

export interface Tool { name: string; description: string; input_schema: any; }

const OPENROUTER = 'https://openrouter.ai/api/v1';

/**
 * A key the Business Head saved in the app. It is kept here (loaded at start-up and when saved) so every part of the server that holds its own
 * AiProvider sees the same key. It wins over the server's environment keys, but AI_PROVIDER=off still switches everything off.
 */
let STORED: { provider: ProviderName; key: string } | null = null;
export const setStoredAiKey = (v: { provider: ProviderName; key: string } | null) => { STORED = v; };
export const storedAiKey = () => STORED;
const MODELS_TTL_MS = 3600000;

/** the models a direct Anthropic key offers to choose from (OpenRouter lists its own) */
export const ANTHROPIC_MODELS = [
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5 (fast, low cost)' },
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5 (balanced)' },
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5 (most capable)' },
  { id: 'claude-fable-5-1', name: 'Claude Fable 5.1' },
];

/** the usage log and monthly limit, set once by the settings service (it holds the database): asked before each request, told after it */
let HOOKS: AiUsageHooks | null = null;
export const setAiUsageHooks = (h: AiUsageHooks | null) => { HOOKS = h; };

/** does a model id match an allowed entry: the id itself, or a prefix ending in * ("anthropic/*") */
export function matchesAllowed(id: string, allowed: string[]): boolean {
  if (!allowed.length) return true;
  return allowed.some((a) => (a.endsWith('*') ? id.startsWith(a.slice(0, -1)) : id === a));
}

/** the arguments of the tool call in a chat-completions reply; some models answer in the message text instead, as JSON */
export function toolArguments(body: any): any {
  const message = body?.choices?.[0]?.message;
  const raw = message?.tool_calls?.[0]?.function?.arguments;
  if (raw) { try { return JSON.parse(raw); } catch { /* fall through to the text */ } }
  const text = typeof message?.content === 'string' ? message.content : '';
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start >= 0 && end > start) { try { return JSON.parse(text.slice(start, end + 1)); } catch { /* not JSON */ } }
  return undefined;
}

/**
 * The one place the app talks to a language model. OpenRouter (any model it offers, chosen in the app) when OPENROUTER_API_KEY is
 * set; otherwise the Anthropic Messages API directly when ANTHROPIC_API_KEY is set (AI_PROVIDER=off switches it off). AI_MODEL is the default model,
 * AI_ALLOWED_MODELS (comma separated, a trailing * allowed) limits what an owner may choose, OPENROUTER_BASE_URL and
 * ANTHROPIC_BASE_URL point at another address (a proxy, or a stand-in for tests).
 */
@Injectable()
export class AiProvider {
  private cache: { at: number; models: ModelInfo[] } | null = null;

  get provider(): ProviderName | null {
    const forced = process.env.AI_PROVIDER;
    if (forced === 'off') return null;        // switched off for this customer, whatever keys are around
    if (STORED) return STORED.provider;
    if (forced === 'openrouter' && process.env.OPENROUTER_API_KEY) return 'openrouter';
    if (forced === 'anthropic' && process.env.ANTHROPIC_API_KEY) return 'anthropic';
    if (process.env.OPENROUTER_API_KEY) return 'openrouter';
    if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
    return null;
  }

  get configured(): boolean { return !!this.provider; }

  /** where the key in use comes from: saved in the app, or the server's environment */
  get keySource(): 'app' | 'server' | null {
    if (!this.provider) return null;
    return STORED && STORED.provider === this.provider ? 'app' : 'server';
  }

  private keyOf(p: ProviderName): string {
    if (STORED && STORED.provider === p) return STORED.key;
    return String(p === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.ANTHROPIC_API_KEY);
  }

  get defaultModel(): string {
    return process.env.AI_MODEL || process.env.ALERT_DRAFT_MODEL || (this.provider === 'anthropic' ? 'claude-haiku-5-5' : '');
  }

  get allowed(): string[] {
    return String(process.env.AI_ALLOWED_MODELS || '').split(',').map((x) => x.trim()).filter(Boolean);
  }

  private base(p: ProviderName): string {
    return (p === 'openrouter' ? process.env.OPENROUTER_BASE_URL || OPENROUTER : process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
  }

  /** the models an owner may choose: those OpenRouter offers that can call tools (and are allowed), or just the one for a direct key */
  async models(): Promise<ModelInfo[]> {
    if (this.provider === 'anthropic') {
      // a direct Anthropic key can use any of these: the server's default first, then the family (within the allow list)
      const listed = [...(this.defaultModel && !ANTHROPIC_MODELS.some((m) => m.id === this.defaultModel) ? [{ id: this.defaultModel, name: this.defaultModel }] : []), ...ANTHROPIC_MODELS]
        .filter((m) => matchesAllowed(m.id, this.allowed));
      return listed.map((m) => ({ id: m.id, name: m.name, context: null, promptPer1M: null, completionPer1M: null, vision: true }));
    }
    if (this.provider !== 'openrouter') return [];
    if (!this.cache || Date.now() - this.cache.at > MODELS_TTL_MS) {
      try {
        const res = await fetch(`${this.base('openrouter')}/models`, { signal: AbortSignal.timeout(15000) });
        const body: any = await res.json();
        const per1M = (v: any) => (Number.isFinite(parseFloat(v)) ? Math.round(parseFloat(v) * 1e6 * 1000) / 1000 : null);
        const models: ModelInfo[] = (body.data || [])
          .filter((m: any) => Array.isArray(m.supported_parameters) && m.supported_parameters.includes('tools'))
          .map((m: any) => ({ id: m.id, name: m.name || m.id, context: m.context_length ?? null, promptPer1M: per1M(m.pricing?.prompt), completionPer1M: per1M(m.pricing?.completion),
            vision: Array.isArray(m.architecture?.input_modalities) ? m.architecture.input_modalities.includes('image') : null }))
          .sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name));
        if (models.length) this.cache = { at: Date.now(), models };
      } catch { /* keep the last list, or fall back to the allowed names below */ }
    }
    const listed = (this.cache?.models || []).filter((m) => matchesAllowed(m.id, this.allowed));
    if (listed.length) return listed;
    return this.allowed.filter((a) => !a.endsWith('*')).map((id) => ({ id, name: id, context: null, promptPer1M: null, completionPer1M: null }));
  }

  async isChoosable(model: string): Promise<boolean> {
    return (await this.models()).some((m) => m.id === model);
  }

  /** one request: the model is made to call `tool`, and the arguments of that call come back. Counted against the monthly limit and logged. */
  async call(system: string, instruction: string, tool: Tool, model: string, maxTokens = 800, images: AiImage[] = []): Promise<any> {
    const p = this.provider;
    if (!p) throw new ServiceUnavailableException('The assistant is not switched on for this account.');
    await HOOKS?.before();                       // refuses when the month's limit is reached
    const started = Date.now();
    const rec: UsageRecord = { provider: p, model, feature: tool.name, ok: false, status: null, inputTokens: null, outputTokens: null, ms: 0 };
    try {
      const out = await this.send(p, system, instruction, tool, model, maxTokens, rec, images);
      rec.ok = out !== undefined;
      return out;
    } finally {
      rec.ms = Date.now() - started;
      try { await HOOKS?.after(rec); } catch { /* the log must never break a request */ }
    }
  }

  private async send(p: ProviderName, system: string, instruction: string, tool: Tool, model: string, maxTokens: number, rec: UsageRecord, images: AiImage[] = []): Promise<any> {
    const refused = () => new ServiceUnavailableException('The assistant could not be reached just now. Try again, or use the form.');
    const text = `<instruction>${instruction}</instruction>`;
    // with pictures the message is a list of parts (the pictures first, then the words); without, it is the plain text as before
    const anthropicContent: any = images.length
      ? [...images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.mediaType, data: i.base64 } })), { type: 'text', text }]
      : text;
    const openRouterContent: any = images.length
      ? [{ type: 'text', text }, ...images.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mediaType};base64,${i.base64}` } }))]
      : text;
    const note = (res: any, body?: any) => {
      rec.status = res.status ?? null;
      if (body) { const t = tokensOf(p, body); rec.inputTokens = t.input; rec.outputTokens = t.output; }
    };
    try {
      if (p === 'anthropic') {
        const res = await fetch(`${this.base(p)}/v1/messages`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': this.keyOf('anthropic'), 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model, max_tokens: maxTokens, system, tools: [tool], tool_choice: { type: 'tool', name: tool.name }, messages: [{ role: 'user', content: anthropicContent }] }),
          signal: AbortSignal.timeout(maxTokens > 800 ? 90000 : 25000),
        });
        note(res);
        if (!res.ok) throw refused();
        const body: any = await res.json();
        note(res, body);
        return (body.content || []).find((c: any) => c.type === 'tool_use')?.input;
      }
      const send = (forced: boolean) => fetch(`${this.base(p)}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.keyOf('openrouter')}`, 'x-title': 'RGP Back Office' },
        body: JSON.stringify({
          model, max_tokens: maxTokens,
          messages: [{ role: 'system', content: system }, { role: 'user', content: openRouterContent }],
          tools: [{ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.input_schema } }],
          ...(forced ? { tool_choice: { type: 'function', function: { name: tool.name } } } : {}),
        }),
        signal: AbortSignal.timeout(maxTokens > 800 ? 120000 : 40000),
      });
      let res = await send(true);
      // not every model accepts a forced tool choice: ask again and let it choose
      if (res.status === 400 || res.status === 404) res = await send(false);
      note(res);
      if (res.status === 401 || res.status === 402) throw new ServiceUnavailableException("The assistant's key was refused or its credit has run out. Tell whoever looks after this account.");
      if (!res.ok) throw refused();
      const body: any = await res.json();
      note(res, body);
      return toolArguments(body);
    } catch (e: any) {
      if (e?.getStatus) throw e;
      throw refused();
    }
  }
}
