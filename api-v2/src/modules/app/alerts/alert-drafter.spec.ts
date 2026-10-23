import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { AlertDrafter, toDraft } from './alert-drafter';

const stores = [{ id: 1, location: 'Main Store' }, { id: 2, location: 'Annex' }];

describe('assistant drafts', () => {
  it('accepts a proposal and cleans it', () => {
    const d = toDraft({ kind: 'licence_expiring', name: 'Licence', params: { days: 45, junk: 9 }, severity: 'critical', recipients: ['owners', 'hackers'], store: 'annex', explanation: 'x' }, stores);
    expect(d).toMatchObject({ kind: 'licence_expiring', params: { days: 45 }, severity: 'critical', storeid: 2, recipients: { roles: ['owners'], userids: [] } });
  });

  it('uses defaults for what is left out', () => {
    expect(toDraft({ kind: 'shift_open_long' }, stores)).toMatchObject({ params: { hours: 14 }, severity: 'warning', storeid: null, recipients: { roles: ['owners', 'managers'] } });
  });

  it('refuses a kind that does not exist, numbers out of range, an unknown store and an unsupported request', () => {
    expect(() => toDraft({ kind: 'sales_drop' }, stores)).toThrow(BadRequestException);
    expect(() => toDraft({ kind: 'shift_open_long', params: { hours: 500 } }, stores)).toThrow(/whole number/);
    expect(() => toDraft({ kind: 'deposit_due', store: 'Nowhere' }, stores)).toThrow(/no store called/);
    expect(() => toDraft({ unsupported_reason: 'Sales are not watched.' }, stores)).toThrow(/can't be set up/);
  });

  it('needs a key, a real sentence, and a rate limit; and passes the instruction to the model inside tags only in the call', async () => {
    const d = new AlertDrafter();
    delete process.env.ANTHROPIC_API_KEY;
    await expect(d.draft('remind me about deposits', stores, 1)).rejects.toThrow(ServiceUnavailableException);
    process.env.ANTHROPIC_API_KEY = 'test-key';
    let seen = '';
    d.useCompletion(async (_system, instruction) => { seen = instruction; return { kind: 'deposit_due', name: 'Deposits' }; });
    await expect(d.draft('hi', stores, 1)).rejects.toThrow(/Say what/);
    await expect(d.draft('x'.repeat(501), stores, 1)).rejects.toThrow(/500/);
    expect((await d.draft('remind me about deposits', stores, 1)).kind).toBe('deposit_due');
    expect(seen).toBe('remind me about deposits');
    for (let i = 0; i < 19; i++) await d.draft('remind me about deposits', stores, 1);
    await expect(d.draft('remind me about deposits', stores, 1)).rejects.toThrow(/lot of drafts/);
    expect((await d.draft('remind me about deposits', stores, 2)).kind).toBe('deposit_due');
    delete process.env.ANTHROPIC_API_KEY;
  });
});
