import { cleanAppUrl, cleanBotToken, setStoredTelegram, telegramAppUrl, telegramSource, telegramToken, telegramUsername, tokenHint } from './telegram-config';

describe('telegram-config', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; setStoredTelegram({ token: null, username: null, appUrl: null }); });

  it('accepts a token as BotFather gives it and rejects the rest', () => {
    expect(cleanBotToken(' 123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw ')).toBe('123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw');
    expect(cleanBotToken('"123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"')).not.toBeNull();
    expect(cleanBotToken('test:token')).toBeNull();
    expect(cleanBotToken('123456789 AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw')).toBeNull();
    expect(cleanBotToken('')).toBeNull();
  });

  it('takes an https address, drops a trailing slash, clears on empty, refuses http', () => {
    expect(cleanAppUrl('https://ops.myrgp.in/')).toBe('https://ops.myrgp.in');
    expect(cleanAppUrl('')).toBeNull();
    expect(cleanAppUrl('http://ops.myrgp.in')).toBeUndefined();
    expect(cleanAppUrl('https://x y')).toBeUndefined();
  });

  it('prefers what was saved in the app over the server environment', () => {
    process.env.TELEGRAM_BOT_TOKEN = 'env:token'; process.env.TELEGRAM_BOT_USERNAME = '@EnvBot'; process.env.APP_BASE_URL = 'https://env.example.com';
    expect(telegramToken()).toBe('env:token'); expect(telegramUsername()).toBe('EnvBot'); expect(telegramAppUrl()).toBe('https://env.example.com'); expect(telegramSource()).toBe('server');
    setStoredTelegram({ token: '1:saved', username: 'SavedBot', appUrl: 'https://saved.example.com' });
    expect(telegramToken()).toBe('1:saved'); expect(telegramUsername()).toBe('SavedBot'); expect(telegramAppUrl()).toBe('https://saved.example.com'); expect(telegramSource()).toBe('app');
  });

  it('is off with neither', () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    expect(telegramToken()).toBeNull(); expect(telegramSource()).toBeNull();
  });

  it('shows only the end of a token', () => { expect(tokenHint('123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw')).toBe('...Dsaw'); });
});
