import { APP_URL_SHAPE, BOT_NAME_SHAPE, BOT_TOKEN_SHAPE, checkBotToken, cleanAppUrl, cleanBotName } from './telegram';

const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw_x';

describe('a customer\'s telegram bot', () => {
  it('takes a token as BotFather gives it and nothing that could break an env file', () => {
    expect(BOT_TOKEN_SHAPE.test(TOKEN)).toBe(true);
    expect(BOT_TOKEN_SHAPE.test('sk-or-v1-0123456789abcdef0123456789abcdef')).toBe(false);
    expect(BOT_TOKEN_SHAPE.test('123456789:short')).toBe(false);
    expect(BOT_TOKEN_SHAPE.test(`${TOKEN}\nJWT_KEY=x`)).toBe(false);
    expect(BOT_TOKEN_SHAPE.test(`${TOKEN} extra`)).toBe(false);
    expect(BOT_TOKEN_SHAPE.test('123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALD$aw_x')).toBe(false);
  });

  it('reads the bot name without the @ and the public address without a trailing slash', () => {
    expect(cleanBotName(' @ShopBot ')).toBe('ShopBot');
    expect(BOT_NAME_SHAPE.test('ShopBot')).toBe(true);
    expect(BOT_NAME_SHAPE.test('Shop')).toBe(false);
    expect(BOT_NAME_SHAPE.test('1ShopBot')).toBe(false);
    expect(BOT_NAME_SHAPE.test('Shop Bot')).toBe(false);
    expect(cleanAppUrl(' https://shop.example.com/ ')).toBe('https://shop.example.com');
    expect(APP_URL_SHAPE.test('https://shop.example.com')).toBe(true);
    expect(APP_URL_SHAPE.test('https://shop.example.com:8443/app')).toBe(true);
    expect(APP_URL_SHAPE.test('http://shop.example.com')).toBe(false);          // only https
    expect(APP_URL_SHAPE.test('https://shop.example.com\nX=1')).toBe(false);
    expect(APP_URL_SHAPE.test('https://shop example.com')).toBe(false);
    expect(APP_URL_SHAPE.test('https://')).toBe(false);
  });

  const reply = (status: number, json: any) => (async () => ({ ok: status >= 200 && status < 300, status, json: async () => json })) as any;

  it('asks Telegram whose token it is, and says plainly when the token is wrong or Telegram cannot be reached', async () => {
    const good = await checkBotToken(TOKEN, reply(200, { ok: true, result: { username: 'ShopBot' } }), 'http://tg');
    expect(good).toEqual({ ok: true, username: 'ShopBot' });
    const bad = await checkBotToken(TOKEN, reply(401, { ok: false, description: 'Unauthorized' }), 'http://tg');
    expect(bad.ok).toBe(false);
    expect(bad.error).toMatch(/does not accept that token/);
    const down = await checkBotToken(TOKEN, (async () => { throw new Error('ECONNREFUSED'); }) as any, 'http://tg');
    expect(down.ok).toBe(false);
    expect(down.error).toMatch(/could not be reached/);
    const odd = await checkBotToken(TOKEN, reply(500, { ok: false, description: 'Internal Server Error' }), 'http://tg');
    expect(odd.ok).toBe(false);
    expect(odd.error).toMatch(/could not check the token/);
  });

  it('calls the address it is given, with the token in the path', async () => {
    let called = '';
    await checkBotToken(TOKEN, (async (url: string) => { called = url; return { ok: true, status: 200, json: async () => ({ ok: true, result: { username: 'ShopBot' } }) }; }) as any, 'http://localhost:4400/');
    expect(called).toBe(`http://localhost:4400/bot${TOKEN}/getMe`);
  });
});
