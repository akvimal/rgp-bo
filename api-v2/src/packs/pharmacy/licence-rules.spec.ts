import { licenceLapsed } from './licence-rules';

describe('licenceLapsed', () => {
  it('is lapsed only when every drug licence has ended', () => {
    expect(licenceLapsed(['2026-10-01'], '2026-10-25')).toBe(true);
    expect(licenceLapsed(['2026-10-01', '2027-01-01'], '2026-10-25')).toBe(false);
  });
  it('is not judged when no licence is recorded', () => {
    expect(licenceLapsed([], '2026-10-25')).toBe(false);
    expect(licenceLapsed([null], '2026-10-25')).toBe(false);
  });
  it('counts the end day as still valid', () => {
    expect(licenceLapsed(['2026-10-25'], '2026-10-25')).toBe(false);
    expect(licenceLapsed(['2026-10-24'], '2026-10-25')).toBe(true);
  });
});
