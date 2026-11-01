import { HOURLY_CAP, formatAlert, inQuiet, istMinute, overCap, parseUpdate, passesSeverity, quietEnds, retryAfterMinutes, toMinutes } from './messaging-rules';

describe('messaging rules', () => {
  it('lets a person choose the level of alert they get', () => {
    expect(passesSeverity('warning', 'info')).toBe(false);
    expect(passesSeverity('warning', 'warning')).toBe(true);
    expect(passesSeverity('warning', 'critical')).toBe(true);
    expect(passesSeverity('critical', 'warning')).toBe(false);
    expect(passesSeverity('info', 'info')).toBe(true);
  });

  it('reads times and quiet hours, which may run past midnight', () => {
    expect(toMinutes('07:30')).toBe(450);
    expect(toMinutes('7:05')).toBe(425);
    expect(toMinutes('25:00')).toBeNull();
    expect(toMinutes('')).toBeNull();
    expect(inQuiet(23 * 60, '22:00', '07:00')).toBe(true);
    expect(inQuiet(3 * 60, '22:00', '07:00')).toBe(true);
    expect(inQuiet(7 * 60, '22:00', '07:00')).toBe(false);          // the end is not quiet
    expect(inQuiet(12 * 60, '22:00', '07:00')).toBe(false);
    expect(inQuiet(13 * 60, '13:00', '14:00')).toBe(true);          // a break inside the day
    expect(inQuiet(5, null, null)).toBe(false);                     // none set
    expect(inQuiet(5, '09:00', '09:00')).toBe(false);
  });

  it('finds when quiet hours end, in India time', () => {
    // 23:30 IST on 1 Nov is 18:00 UTC; quiet ends at 07:00 IST = 01:30 UTC next day
    const at = new Date('2026-11-01T18:00:00Z');
    expect(istMinute(at)).toBe(23 * 60 + 30);
    expect(quietEnds(at, '07:00').toISOString()).toBe('2026-11-02T01:30:00.000Z');
    // 03:00 IST (21:30 UTC the day before): ends the same morning
    expect(quietEnds(new Date('2026-11-01T21:30:00Z'), '07:00').toISOString()).toBe('2026-11-02T01:30:00.000Z');
  });

  it('retries with longer waits and then gives up', () => {
    expect(retryAfterMinutes(1)).toBe(1);
    expect(retryAfterMinutes(2)).toBe(5);
    expect(retryAfterMinutes(5)).toBe(360);
    expect(retryAfterMinutes(6)).toBeNull();
    expect(retryAfterMinutes(0)).toBeNull();
  });

  it('caps the lower levels in an hour but never a critical alert', () => {
    expect(overCap(HOURLY_CAP - 1, 'warning')).toBe(false);
    expect(overCap(HOURLY_CAP, 'warning')).toBe(true);
    expect(overCap(HOURLY_CAP + 50, 'critical')).toBe(false);
  });

  it('writes the alert, with a link only when the app has a public https address', () => {
    const m = { title: 'Bank deposit due: Main Store', body: 'Bank it today.', severity: 'critical', link: '/secure/store/cash' };
    expect(formatAlert({ ...m, baseUrl: 'https://shop.example.com/' })).toBe('\u{1F534} Bank deposit due: Main Store\nBank it today.\nhttps://shop.example.com/secure/store/cash');
    expect(formatAlert({ ...m, baseUrl: 'http://localhost:8201' })).toBe('\u{1F534} Bank deposit due: Main Store\nBank it today.');
    expect(formatAlert({ ...m, baseUrl: '' })).not.toContain('http');
    expect(formatAlert({ title: 't', body: 'b'.repeat(6000), severity: 'info' }).length).toBe(4000);
  });

  it('understands what a person types to the bot', () => {
    const msg = (text: string, type = 'private') => ({ message: { text, chat: { id: 42, type }, from: { username: 'asha' } } });
    expect(parseUpdate(msg('/start abc123'))).toEqual({ kind: 'start', token: 'abc123', chatId: '42', handle: 'asha' });
    expect(parseUpdate(msg('/start'))).toMatchObject({ kind: 'start', token: '' });
    expect(parseUpdate(msg('/START@ShopBot xyz'))).toMatchObject({ kind: 'start', token: 'xyz' });
    expect(parseUpdate(msg('/stop'))).toEqual({ kind: 'stop', chatId: '42' });
    expect(parseUpdate(msg('/status'))).toMatchObject({ kind: 'status' });
    expect(parseUpdate(msg('hello'))).toMatchObject({ kind: 'other' });
    expect(parseUpdate(msg('/start abc', 'group'))).toBeNull();      // only private chats
    expect(parseUpdate({})).toBeNull();
  });
});
