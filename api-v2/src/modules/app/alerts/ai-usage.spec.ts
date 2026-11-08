import { DEFAULT_MONTHLY_LIMIT, featureLabel, limitState, parseLimit, tokensOf, validLimit } from './ai-usage';
import { AiProvider, setAiUsageHooks, setStoredAiKey } from './ai-provider';

describe('the assistant usage limit', () => {
  it('reads a stored limit, and falls back when it is damaged', () => {
    expect(parseLimit('250')).toBe(250);
    expect(parseLimit('0')).toBe(0);
    expect(parseLimit('abc')).toBe(DEFAULT_MONTHLY_LIMIT);
    expect(parseLimit(undefined)).toBe(DEFAULT_MONTHLY_LIMIT);
    expect(parseLimit('-5')).toBe(DEFAULT_MONTHLY_LIMIT);
    expect(parseLimit('12.5')).toBe(DEFAULT_MONTHLY_LIMIT);
  });

  it('accepts only a whole number in range from a person', () => {
    expect(validLimit('300')).toBe(300);
    expect(validLimit(0)).toBe(0);
    expect(validLimit('')).toBeNull();
    expect(validLimit('3.5')).toBeNull();
    expect(validLimit(-1)).toBeNull();
    expect(validLimit(1000000)).toBeNull();
    expect(validLimit('lots')).toBeNull();
  });

  it('says where the month stands', () => {
    expect(limitState(10, 300)).toBe('ok');
    expect(limitState(239, 300)).toBe('ok');
    expect(limitState(240, 300)).toBe('near');
    expect(limitState(299, 300)).toBe('near');
    expect(limitState(300, 300)).toBe('reached');
    expect(limitState(500, 300)).toBe('reached');
    expect(limitState(9999, 0)).toBe('none');
  });

  it('reads the tokens each provider reports, and tolerates a reply without them', () => {
    expect(tokensOf('anthropic', { usage: { input_tokens: 120, output_tokens: 45 } })).toEqual({ input: 120, output: 45 });
    expect(tokensOf('openrouter', { usage: { prompt_tokens: 80, completion_tokens: 30 } })).toEqual({ input: 80, output: 30 });
    expect(tokensOf('anthropic', {})).toEqual({ input: null, output: null });
    expect(tokensOf('openrouter', { usage: { prompt_tokens: 'x' } })).toEqual({ input: null, output: null });
  });

  it('gives a name to each assistant and passes an unknown one through', () => {
    expect(featureLabel('propose_kpis')).toBe('KPI drafts');
    expect(featureLabel('something_new')).toBe('something_new');
  });
});

describe('the provider with usage hooks', () => {
  const TOOL = { name: 'propose_role', description: 'd', input_schema: { type: 'object', properties: {} } };
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; setAiUsageHooks(null); setStoredAiKey(null); });

  const reply = (status: number, body: any) => (global.fetch = jest.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body }) as any);

  it('records a request with its tokens, and refuses before sending when the limit is reached', async () => {
    setStoredAiKey({ provider: 'anthropic', key: 'sk-ant-test-key-000000000000' });
    const seen: any[] = [];
    let allowed = true;
    setAiUsageHooks({ before: async () => { if (!allowed) throw new Error('limit'); }, after: (r) => { seen.push(r); } });
    reply(200, { content: [{ type: 'tool_use', input: { purpose: 'x' } }], usage: { input_tokens: 10, output_tokens: 5 } });
    const out = await new AiProvider().call('s', 'i', TOOL, 'm');
    expect(out).toEqual({ purpose: 'x' });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ provider: 'anthropic', model: 'm', feature: 'propose_role', ok: true, status: 200, inputTokens: 10, outputTokens: 5 });

    allowed = false;
    (global.fetch as jest.Mock).mockClear();
    await expect(new AiProvider().call('s', 'i', TOOL, 'm')).rejects.toThrow('limit');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(seen).toHaveLength(1);
  });

  it('records a failed request as failed', async () => {
    setStoredAiKey({ provider: 'anthropic', key: 'sk-ant-test-key-000000000000' });
    const seen: any[] = [];
    setAiUsageHooks({ before: async () => undefined, after: (r) => { seen.push(r); } });
    reply(500, {});
    await expect(new AiProvider().call('s', 'i', TOOL, 'm')).rejects.toBeDefined();
    expect(seen[0]).toMatchObject({ ok: false, status: 500, feature: 'propose_role' });
  });

  it('works as before with no hooks', async () => {
    setStoredAiKey({ provider: 'anthropic', key: 'sk-ant-test-key-000000000000' });
    reply(200, { content: [{ type: 'tool_use', input: { a: 1 } }] });
    expect(await new AiProvider().call('s', 'i', TOOL, 'm')).toEqual({ a: 1 });
  });
});
