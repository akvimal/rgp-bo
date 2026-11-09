import * as fs from 'fs';
import * as path from 'path';
import { AiPolicy, POLICIES, briefFingerprint, cacheOn, decide, fingerprint, normaliseQuestion, policyOf, questionFingerprint, refreshesLeft, refusalMessage, stable } from './ai-cache-rules';

const H = 3600000;
const now = new Date('2026-11-09T10:00:00Z');
const ago = (h: number) => new Date(now.getTime() - h * H);
const policy: AiPolicy = { ttlHours: 72, refresh: { max: 2, perHours: 24 }, refreshWhenUnchanged: true, calls: null };
const entry = { createdOn: ago(5) };

describe('AI cache rules', () => {
  it('the same facts give the same fingerprint, whatever order they were written in', () => {
    expect(stable({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(stable({ a: [2, { c: 2, d: 1 }], b: 1 }));
    expect(fingerprint({ x: 1, y: 2 })).toBe(fingerprint({ y: 2, x: 1 }));
    expect(fingerprint({ x: 1 })).not.toBe(fingerprint({ x: 2 }));
    expect(fingerprint({ x: 1 })).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprint({ a: 1, b: undefined })).toBe(fingerprint({ a: 1 }));                       // as it is when read back from the database
    expect(fingerprint({ when: new Date('2026-01-01T00:00:00Z') })).toBe(fingerprint({ when: '2026-01-01T00:00:00.000Z' }));
  });

  it('a question is the same question however it is typed', () => {
    expect(normaliseQuestion('  Sales   last WEEK?? ')).toBe('sales last week');
    expect(questionFingerprint('Sales last week?', '2026-11-09', true)).toBe(questionFingerprint('sales  last week', '2026-11-09', true));
    expect(questionFingerprint('sales last week', '2026-11-09', true)).not.toBe(questionFingerprint('sales last week', '2026-11-10', true));   // "last week" moves with the day
    expect(questionFingerprint('sales last week', '2026-11-09', true)).not.toBe(questionFingerprint('sales last week', '2026-11-09', false)); // an owner sees more reports
  });

  it('a brief is kept while only the quantities and days left change, and renewed by a new purchase or product', () => {
    const base = briefFingerprint(['Dolo 650', 'Telma 40'], ['Amox 500'], '2026-11-08T10:00|412');
    expect(briefFingerprint(['telma 40 ', 'DOLO 650'], ['amox 500'], '2026-11-08T10:00|412')).toBe(base);        // order, case and spaces do not matter
    expect(briefFingerprint(['Dolo 650', 'Telma 40'], ['Amox 500'], '2026-11-09T09:00|413')).not.toBe(base);     // a new purchase line
    expect(briefFingerprint(['Dolo 650', 'Telma 40', 'Pan 40'], ['Amox 500'], '2026-11-08T10:00|412')).not.toBe(base);   // a new product to reorder
    expect(briefFingerprint(['Dolo 650', 'Telma 40'], [], '2026-11-08T10:00|412')).not.toBe(base);              // nothing at risk any more
  });

  it('a kept answer is served without a request', () => {
    expect(decide({ entry, now, refresh: false, policy, refreshTimes: [], callTimes: [] })).toEqual({ action: 'serve' });
  });

  it('with nothing kept, the first request is made', () => {
    expect(decide({ entry: null, now, refresh: false, policy, refreshTimes: [], callTimes: [] })).toEqual({ action: 'call', kind: 'MISS' });
    expect(decide({ entry: null, now, refresh: true, policy, refreshTimes: [], callTimes: [] })).toEqual({ action: 'call', kind: 'MISS' });   // nothing to refresh
  });

  it('a refresh of unchanged facts is refused where the wording would not change', () => {
    const d = decide({ entry, now, refresh: true, policy: { ...policy, refreshWhenUnchanged: false }, refreshTimes: [], callTimes: [] });
    expect(d).toEqual({ action: 'refuse', reason: 'unchanged', nextAllowedAt: null });
  });

  it('a refresh is allowed up to its limit, and says when the next one is', () => {
    expect(decide({ entry, now, refresh: true, policy, refreshTimes: [ago(2)], callTimes: [] })).toEqual({ action: 'call', kind: 'REFRESH' });
    const d = decide({ entry, now, refresh: true, policy, refreshTimes: [ago(2), ago(20)], callTimes: [] });
    expect(d).toMatchObject({ action: 'refuse', reason: 'refresh_limit' });
    expect((d as any).nextAllowedAt.getTime()).toBe(ago(20).getTime() + 24 * H);                  // when the oldest one falls out of the day
    // old refreshes no longer count
    expect(decide({ entry, now, refresh: true, policy, refreshTimes: [ago(30), ago(40)], callTimes: [] })).toEqual({ action: 'call', kind: 'REFRESH' });
  });

  it('a person cannot make more new requests than the cap, but a kept answer is always served', () => {
    const capped: AiPolicy = { ...policy, calls: { max: 3, perHours: 1 } };
    const calls = [ago(0.1), ago(0.2), ago(0.9)];
    expect(decide({ entry: null, now, refresh: false, policy: capped, refreshTimes: [], callTimes: calls })).toMatchObject({ action: 'refuse', reason: 'call_limit' });
    expect(decide({ entry, now, refresh: false, policy: capped, refreshTimes: [], callTimes: calls })).toEqual({ action: 'serve' });    // no request is made, so no cap
    expect(decide({ entry: null, now, refresh: false, policy: capped, refreshTimes: [], callTimes: [ago(2), ago(3), ago(4)] })).toEqual({ action: 'call', kind: 'MISS' });
  });

  it('counts the refreshes left', () => {
    expect(refreshesLeft(policy, [ago(1)], now)).toBe(1);
    expect(refreshesLeft(policy, [ago(1), ago(2), ago(3)], now)).toBe(0);
    expect(refreshesLeft(POLICIES.answer_question, [], now)).toBeNull();
  });

  it('refusals explain themselves', () => {
    expect(refusalMessage('unchanged', null, now, 'brief')).toMatch(/Nothing it is based on has changed/);
    expect(refusalMessage('refresh_limit', new Date(now.getTime() + 20 * 60000), now, 'brief')).toMatch(/in about 20 minutes/);
    expect(refusalMessage('call_limit', new Date(now.getTime() + 5 * H), now, 'brief')).toMatch(/in about 5 hours/);
  });

  it('the phase 1 features have a policy, and the others none yet', () => {
    for (const f of ['write_buying_brief', 'answer_question', 'write_coaching_note', 'write_weekly_summary']) expect(policyOf(f)).not.toBeNull();
    expect(policyOf('propose_role')).toBeNull();
    expect(POLICIES.write_buying_brief.refreshWhenUnchanged).toBe(false);          // the brief would come out the same
    expect(POLICIES.write_coaching_note.refresh!.max).toBe(3);
  });

  it('only an explicit off switches the cache off', () => {
    expect(cacheOn(undefined)).toBe(true);
    expect(cacheOn('on')).toBe(true);
    expect(cacheOn('')).toBe(true);
    expect(cacheOn('OFF')).toBe(false);
    expect(cacheOn(' off ')).toBe(false);
  });

  it('the migration allows exactly the event kinds the code uses', () => {
    const sql = fs.readFileSync(path.join(__dirname, '../../../../../sql/migrations/178_ai_cache.sql'), 'utf8');
    const kinds = [...sql.match(/ai_cache_event_kind_chk CHECK \(kind IN \(([^)]*)\)/)![1].matchAll(/'([A-Z]+)'/g)].map((m) => m[1]).sort();
    expect(kinds).toEqual(['HIT', 'MISS', 'REFRESH', 'REFUSED']);
  });
});
