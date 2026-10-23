import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export type ProviderName = 'openrouter' | 'anthropic';

export interface ModelInfo { id: string; name: string; context: number | null; promptPer1M: number | null; completionPer1M: number | null; }

export interface Tool { name: string; description: string; input_schema: any; }

const OPENROUTER = 'https://openrouter.ai/api/v1';
const MODELS_TTL_MS = 3600000;

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
    if (forced === 'openrouter' && process.env.OPENROUTER_API_KEY) return 'openrouter';
    if (forced === 'anthropic' && process.env.ANTHROPIC_API_KEY) return 'anthropic';
    if (process.env.OPENROUTER_API_KEY) return 'openrouter';
    if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
    return null;
  }

  get configured(): boolean { return !!this.provider; }

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
    if (this.provider !== 'openrouter') return this.defaultModel ? [{ id: this.defaultModel, name: this.defaultModel, context: null, promptPer1M: null, completionPer1M: null }] : [];
    if (!this.cache || Date.now() - this.cache.at > MODELS_TTL_MS) {
      try {
        const res = await fetch(`${this.base('openrouter')}/models`, { signal: AbortSignal.timeout(15000) });
        const body: any = await res.json();
        const per1M = (v: any) => (Number.isFinite(parseFloat(v)) ? Math.round(parseFloat(v) * 1e6 * 1000) / 1000 : null);
        const models: ModelInfo[] = (body.data || [])
          .filter((m: any) => Array.isArray(m.supported_parameters) && m.supported_parameters.includes('tools'))
          .map((m: any) => ({ id: m.id, name: m.name || m.id, context: m.context_length ?? null, promptPer1M: per1M(m.pricing?.prompt), completionPer1M: per1M(m.pricing?.completion) }))
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

  /** one request: the model is made to call `tool`, and the arguments of that call come back */
  async call(system: string, instruction: string, tool: Tool, model: string): Promise<any> {
    const p = this.provider;
    if (!p) throw new ServiceUnavailableException('The assistant is not switched on for this account.');
    const refused = () => new ServiceUnavailableException('The assistant could not be reached just now. Try again, or use the form.');
    const content = `<instruction>${instruction}</instruction>`;
    try {
      if (p === 'anthropic') {
        const res = await fetch(`${this.base(p)}/v1/messages`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': String(process.env.ANTHROPIC_API_KEY), 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model, max_tokens: 800, system, tools: [tool], tool_choice: { type: 'tool', name: tool.name }, messages: [{ role: 'user', content }] }),
          signal: AbortSignal.timeout(25000),
        });
        if (!res.ok) throw refused();
        return ((await res.json() as any).content || []).find((c: any) => c.type === 'tool_use')?.input;
      }
      const send = (forced: boolean) => fetch(`${this.base(p)}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'x-title': 'RGP Back Office' },
        body: JSON.stringify({
          model, max_tokens: 800,
          messages: [{ role: 'system', content: system }, { role: 'user', content }],
          tools: [{ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.input_schema } }],
          ...(forced ? { tool_choice: { type: 'function', function: { name: tool.name } } } : {}),
        }),
        signal: AbortSignal.timeout(40000),
      });
      let res = await send(true);
      // not every model accepts a forced tool choice: ask again and let it choose
      if (res.status === 400 || res.status === 404) res = await send(false);
      if (res.status === 401 || res.status === 402) throw new ServiceUnavailableException('The assistant\'s key was refused or its credit has run out. Tell whoever looks after this account.');
      if (!res.ok) throw refused();
      return toolArguments(await res.json());
    } catch (e: any) {
      if (e?.getStatus) throw e;
      throw refused();
    }
  }
}
