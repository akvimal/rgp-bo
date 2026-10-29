import { MESSAGE_CODES, render } from './alert-messages';
import { KINDS } from './alert-kinds';
import { canSee } from './alert-access';

describe('alert messages', () => {
  it('renders English with money and dates formatted', () => {
    const m = render('deposit_due_amount', { store: 'Main', balance: 123456, excess: 23456 }, 'en');
    expect(m.title).toBe('Bank deposit due: Main');
    expect(m.body).toContain('₹1,23,456');
    expect(render('licence_expiring', { store: 'Main', type: 'Drug', date: '2026-11-05', days: 12 }).title).toBe('Drug licence ends on 5 Nov 2026: Main');
  });

  it('names the licence kinds for a person, in the reader language', () => {
    const p = { store: 'Main', type: 'RETAIL_20_21', date: '2026-11-05', days: 12 };
    expect(render('licence_expiring', p, 'en').title).toBe('Retail drug licence ends on 5 Nov 2026: Main');
    expect(render('licence_expiring', p, 'ta').title).toContain('சில்லறை மருந்து');
  });

  it('renders Tamil, and falls back to English for an unknown language', () => {
    const p = { store: 'Main', name: 'Morning', hours: 15 };
    expect(render('shift_open_long', p, 'ta').title).toContain('ஷிப்ட்');
    expect(render('shift_open_long', p, 'fr')).toEqual(render('shift_open_long', p, 'en'));
  });

  it('has text in both languages for every code, with the same placeholders', () => {
    const holes = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(',');
    for (const code of MESSAGE_CODES) {
      const en = render(code, {}, 'en'), ta = render(code, {}, 'ta');
      expect(ta.title).not.toBe(en.title);
      const raw = (l: any) => holes(JSON.stringify(l));
      expect(raw(ta)).toBe(raw(en));
    }
  });

  it('every kind raises only codes the catalogue knows', () => {
    const codes: Record<string, string[]> = {
      deposit_due: ['deposit_due_amount', 'deposit_due_schedule'], licence_expiring: ['licence_expiring', 'licence_expired'],
      registration_expiring: ['registration_expiring', 'registration_expired'], shift_open_long: ['shift_open_long'], approvals_pending: ['approvals_pending', 'approvals_pending_one'],
      price_policy: ['pricing_cuts', 'pricing_raises', 'pricing_check', 'pricing_unpriced'],
      outage_kit: ['outage_kit_overdue', 'outage_kit_never'],
      stock_count_overdue: ['stock_count_overdue', 'stock_count_never'],
      negative_stock: ['negative_stock'],
      expired_stock: ['expired_stock'],
      adjustment_other: ['adjustment_other'],
      weekly_review: ['weekly_review_unsigned'],
      gst_rate_change: ['gst_rate_change_soon'],
      gst_filing_due: ['gst_filing_due', 'gst_filing_late'],
      compliance_late: ['compliance_escalated', 'compliance_parked'],
    };
    expect(KINDS.map((k) => k.kind).sort()).toEqual(Object.keys(codes).sort());
    for (const list of Object.values(codes)) for (const c of list) expect(MESSAGE_CODES).toContain(c);
  });
});

describe('who may see an alert', () => {
  const rec = { roles: ['owners', 'managers'], userids: [] };
  const owner = { id: 1, role: 'Business Head', owner: true, storeIds: [] };
  const head = { id: 2, role: 'Store Head', owner: false, storeIds: [10] };
  const sales = { id: 3, role: 'Sales Staff', owner: false, storeIds: [10] };

  it('follows the rule\'s recipients and the person\'s stores', () => {
    expect(canSee(rec, owner, 99)).toBe(true);
    expect(canSee(rec, head, 10)).toBe(true);
    expect(canSee(rec, head, 11)).toBe(false);
    expect(canSee(rec, head, null)).toBe(true);
    expect(canSee(rec, sales, 10)).toBe(false);
    expect(canSee({ roles: ['staff'], userids: [] }, sales, 10)).toBe(true);
    expect(canSee({ roles: ['staff'], userids: [] }, head, 10)).toBe(false);
    expect(canSee({ roles: [], userids: [3] }, sales, 10)).toBe(true);
  });
});
