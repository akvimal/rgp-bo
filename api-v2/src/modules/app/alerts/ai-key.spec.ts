import { cleanKey, decryptKey, encryptKey, keyHint } from './ai-key';
import { AiProvider, setStoredAiKey } from './ai-provider';

describe('the stored AI key', () => {
  it('is sealed and opens again, differently each time', () => {
    const a = encryptKey('sk-ant-0123456789abcdef0123'), b = encryptKey('sk-ant-0123456789abcdef0123');
    expect(a).not.toContain('sk-ant');
    expect(a).not.toBe(b);
    expect(decryptKey(a)).toBe('sk-ant-0123456789abcdef0123');
  });
  it('does not open when damaged or sealed with another secret', () => {
    const sealed = encryptKey('sk-ant-0123456789abcdef0123');
    expect(decryptKey(sealed.slice(0, -4) + 'AAAA')).toBeNull();
    expect(decryptKey('nonsense')).toBeNull();
    expect(decryptKey(null)).toBeNull();
    const old = process.env.JWT_KEY;
    process.env.JWT_KEY = 'a-different-secret';
    expect(decryptKey(sealed)).toBeNull();
    process.env.JWT_KEY = old;
  });
  it('shows only the last four characters', () => { expect(keyHint('sk-ant-0123456789abcdef0123')).toBe('...0123'); expect(keyHint('short')).toBe(''); });
  it('is cleaned as pasted and refused when it cannot be a key', () => {
    expect(cleanKey('  "sk-ant-0123456789abcdef0123" ')).toBe('sk-ant-0123456789abcdef0123');
    expect(cleanKey('too short')).toBeNull();
    expect(cleanKey('has a space in it 0123456789')).toBeNull();
    expect(cleanKey(undefined)).toBeNull();
  });
});

describe('AiProvider with a key saved in the app', () => {
  const save = { ...process.env };
  afterEach(() => { setStoredAiKey(null); process.env = { ...save }; jest.restoreAllMocks(); });
  it('uses it ahead of the server key, and reports where the key came from', () => {
    process.env.OPENROUTER_API_KEY = 'server-key';
    delete process.env.AI_PROVIDER;
    const ai = new AiProvider();
    expect([ai.provider, ai.keySource]).toEqual(['openrouter', 'server']);
    setStoredAiKey({ provider: 'anthropic', key: 'app-key-0123456789abcdef' });
    expect([ai.provider, ai.keySource]).toEqual(['anthropic', 'app']);
  });
  it('is switched off by AI_PROVIDER=off whatever is saved', () => {
    process.env.AI_PROVIDER = 'off';
    setStoredAiKey({ provider: 'anthropic', key: 'app-key-0123456789abcdef' });
    expect(new AiProvider().configured).toBe(false);
  });
  it('is sent as the request key', async () => {
    delete process.env.OPENROUTER_API_KEY; delete process.env.ANTHROPIC_API_KEY; delete process.env.AI_PROVIDER;
    setStoredAiKey({ provider: 'anthropic', key: 'app-key-0123456789abcdef' });
    const f = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => ({ content: [{ type: 'tool_use', input: { ok: true } }] }) } as any);
    const out = await new AiProvider().call('s', 'i', { name: 'reply', description: 'd', input_schema: { type: 'object', properties: {} } }, 'claude-haiku-5-5', 3000);
    expect(out).toEqual({ ok: true });
    const init: any = f.mock.calls[0][1];
    expect(init.headers['x-api-key']).toBe('app-key-0123456789abcdef');
    expect(JSON.parse(init.body).max_tokens).toBe(3000);
  });
});
