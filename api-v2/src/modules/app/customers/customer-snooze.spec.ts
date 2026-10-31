import { SNOOZE_REASONS, checkSnooze } from './customer-snooze';

describe('postponing a customer on the contact list', () => {
  it('needs one of the listed reasons', () => {
    expect(checkSnooze({}).ok).toBe(false);
    expect(checkSnooze({ reason: 'NOPE' }).ok).toBe(false);
    for (const r of Object.keys(SNOOZE_REASONS).filter((k) => k !== 'OTHER')) expect(checkSnooze({ reason: r }).ok).toBe(true);
  });

  it('asks for a few words when the reason is "Other", and for nothing more with the others', () => {
    expect(checkSnooze({ reason: 'OTHER' }).ok).toBe(false);
    expect(checkSnooze({ reason: 'OTHER', note: ' ok ' }).ok).toBe(false);
    const r = checkSnooze({ reason: 'OTHER', note: '  Gone   to hospital ' });
    expect(r.ok && r.value.note).toBe('Gone to hospital');
    const away = checkSnooze({ reason: 'AWAY', note: '' });
    expect(away.ok && away.value.note).toBeNull();
  });

  it('keeps a note short', () => {
    const r = checkSnooze({ reason: 'AWAY', note: 'x'.repeat(500) });
    expect(r.ok && r.value.note!.length).toBe(200);
  });
});
