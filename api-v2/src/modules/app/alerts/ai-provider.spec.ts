import { AiProvider, matchesAllowed, toolArguments } from './ai-provider';

const TOOL = { name: 'propose_alert_rule', description: 'd', input_schema: { type: 'object', properties: {} } };
const reply = (body: any, status = 200) => ({ ok: status < 300, status, json: async () => body }) as any;
const env = (o: Record<string, string | undefined>) => {
  for (const k of ['OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'AI_PROVIDER', 'AI_MODEL', 'AI_ALLOWED_MODELS', 'ALERT_DRAFT_MODEL']) delete process.env[k];
  Object.assign(process.env, o);
};

describe('model allow list', () => {
  it('matches ids and prefixes; an empty list allows all', () => {
    expect(matchesAllowed('openai/gpt-4o', [])).toBe(true);
    expect(matchesAllowed('openai/gpt-4o', ['openai/gpt-4o'])).toBe(true);
    expect(matchesAllowed('openai/gpt-4o-mini', ['openai/gpt-4o'])).toBe(false);
    expect(matchesAllowed('anthropic/claude-x', ['anthropic/*'])).toBe(true);
    expect(matchesAllowed('google/gemini', ['anthropic/*', 'openai/gpt-4o'])).toBe(false);
  });
});

describe('reading a reply', () => {
  it('takes the tool call arguments, or JSON in the text', () => {
    expect(toolArguments({ choices: [{ message: { tool_calls: [{ function: { arguments: '{"kind":"deposit_due"}' } }] } }] })).toEqual({ kind: 'deposit_due' });
    expect(toolArguments({ choices: [{ message: { content: 'Here you go:\n{"kind":"shift_open_long"}\nDone' } }] })).toEqual({ kind: 'shift_open_long' });
    expect(toolArguments({ choices: [{ message: { content: 'no json here' } }] })).toBeUndefined();
    expect(toolArguments({})).toBeUndefined();
  });
});

describe('AiProvider', () => {
  afterEach(() => { env({}); jest.restoreAllMocks(); });

  it('prefers OpenRouter, falls back to a direct Anthropic key, and is off without either', () => {
    env({});
    expect(new AiProvider().provider).toBeNull();
    env({ ANTHROPIC_API_KEY: 'a' });
    expect(new AiProvider().provider).toBe('anthropic');
    expect(new AiProvider().defaultModel).toBe('claude-haiku-5-5');
    env({ ANTHROPIC_API_KEY: 'a', OPENROUTER_API_KEY: 'o' });
    expect(new AiProvider().provider).toBe('openrouter');
    env({ ANTHROPIC_API_KEY: 'a', OPENROUTER_API_KEY: 'o', AI_PROVIDER: 'anthropic' });
    expect(new AiProvider().provider).toBe('anthropic');
    env({ ANTHROPIC_API_KEY: 'a', OPENROUTER_API_KEY: 'o', AI_PROVIDER: 'off' });
    expect(new AiProvider().provider).toBeNull();
    expect(new AiProvider().configured).toBe(false);
  });

  it('lists the models that can call tools, within the allow list, with prices per million tokens', async () => {
    env({ OPENROUTER_API_KEY: 'o', AI_ALLOWED_MODELS: 'openai/*,google/gemini-x' });
    jest.spyOn(global, 'fetch').mockResolvedValue(reply({
      data: [
        { id: 'openai/gpt-a', name: 'GPT A', context_length: 1000, pricing: { prompt: '0.0000005', completion: '0.0000015' }, supported_parameters: ['tools'] },
        { id: 'openai/gpt-b', name: 'GPT B', supported_parameters: ['temperature'] },
        { id: 'meta/llama', name: 'Llama', supported_parameters: ['tools'] },
        { id: 'google/gemini-x', name: 'Gemini X', supported_parameters: ['tools', 'temperature'] },
      ],
    }));
    const ai = new AiProvider();
    const list = await ai.models();
    expect(list.map((m) => m.id)).toEqual(['google/gemini-x', 'openai/gpt-a']);
    expect(list.find((m) => m.id === 'openai/gpt-a')).toMatchObject({ promptPer1M: 0.5, completionPer1M: 1.5, context: 1000 });
    expect(await ai.isChoosable('meta/llama')).toBe(false);
    expect(await ai.isChoosable('openai/gpt-a')).toBe(true);
  });

  it('calls OpenRouter with the chosen model and the forced tool, and asks again without the forced choice if refused', async () => {
    env({ OPENROUTER_API_KEY: 'o' });
    const spy = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(reply({ error: 'no tool_choice' }, 404))
      .mockResolvedValueOnce(reply({ choices: [{ message: { tool_calls: [{ function: { arguments: '{"kind":"deposit_due"}' } }] } }] }));
    expect(await new AiProvider().call('sys', 'the sentence', TOOL, 'openai/gpt-a')).toEqual({ kind: 'deposit_due' });
    const first = JSON.parse((spy.mock.calls[0][1] as any).body), second = JSON.parse((spy.mock.calls[1][1] as any).body);
    expect(String(spy.mock.calls[0][0])).toContain('/chat/completions');
    expect(first.model).toBe('openai/gpt-a');
    expect(first.tool_choice).toBeDefined();
    expect(second.tool_choice).toBeUndefined();
    expect(first.messages[1].content).toBe('<instruction>the sentence</instruction>');
  });

  it('says so when the key is refused', async () => {
    env({ OPENROUTER_API_KEY: 'o' });
    jest.spyOn(global, 'fetch').mockResolvedValue(reply({}, 402));
    await expect(new AiProvider().call('s', 'i', TOOL, 'm')).rejects.toThrow(/credit has run out/);
  });
});
