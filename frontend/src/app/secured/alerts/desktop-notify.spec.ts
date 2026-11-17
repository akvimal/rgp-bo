import { describe as describeNotice, freshAlerts, isLevel, worthInterrupting } from './desktop-notify';

const a = (id: number, severity: string, extra: any = {}) => ({ id, severity, title: `Alert ${id}`, read: false, ...extra });

describe('desktop notifications for the alerts', () => {
  it('picks only new, unread alerts at or above the chosen level', () => {
    const items = [a(1, 'critical'), a(2, 'warning'), a(3, 'info'), a(4, 'critical', { read: true })];
    expect(freshAlerts(items, new Set(), 'warning').map((x) => x.id)).toEqual([1, 2]);
    expect(freshAlerts(items, new Set(), 'critical').map((x) => x.id)).toEqual([1]);
  });

  it('never picks an alert it has already seen', () => {
    expect(freshAlerts([a(1, 'critical'), a(2, 'critical')], new Set([1]), 'warning').map((x) => x.id)).toEqual([2]);
  });

  it('treats an alert with no severity as the lowest, so it is never notified', () => {
    expect(freshAlerts([{ id: 9, title: 'x' }], new Set(), 'warning')).toEqual([]);
  });

  it('shows one alert by its headline and link, and never its details', () => {
    const n = describeNotice([a(1, 'critical', { title: 'Approvals waiting', message: 'Ravi owes Rs 12,000', link: '/secure/review' })])!;
    expect(n).toMatchObject({ title: 'Approvals waiting', link: '/secure/review', ids: [1] });
    expect(JSON.stringify(n)).not.toContain('Ravi');
    expect(JSON.stringify(n)).not.toContain('12,000');
  });

  it('merges several into one notification that opens the list', () => {
    const n = describeNotice([a(1, 'critical'), a(2, 'warning'), a(3, 'warning')])!;
    expect(n.title).toBe('3 alerts need your attention');
    expect(n.body).toContain('Alert 1 and 2 more');
    expect(n.link).toBe('/secure/notifications');
    expect(n.ids).toEqual([1, 2, 3]);
  });

  it('shows nothing for nothing', () => {
    expect(describeNotice([])).toBeNull();
  });

  it('interrupts only when the person is not looking at the app', () => {
    expect(worthInterrupting(true, true)).toBeFalse();
    expect(worthInterrupting(false, true)).toBeTrue();
    expect(worthInterrupting(true, false)).toBeTrue();
  });

  it('knows the two levels', () => {
    expect(isLevel('critical')).toBeTrue();
    expect(isLevel('warning')).toBeTrue();
    expect(isLevel('info')).toBeFalse();
    expect(isLevel(undefined)).toBeFalse();
  });
});
