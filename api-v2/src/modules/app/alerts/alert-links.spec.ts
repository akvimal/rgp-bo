import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Every link an alert carries must be a page the app has, and the alerts about one thing must link to that thing, not to a list it is somewhere in.
 * The pages are listed here as patterns (a number stands for an id); add a page here when an alert starts to point at it.
 */
const PAGES: RegExp[] = [
  /^\/secure\/purchases\/requests$/,
  /^\/secure\/commitments(\/\d+)?$/,
  /^\/secure\/store\/(vault|cash|shifts)$/,
  /^\/secure\/store\/stock(\/(adjust|expiry|passes\/\d+))?$/,
  /^\/secure\/settings\/(store|users\/edit\/\d+)$/,
  /^\/secure\/gst-filing$/,
  /^\/secure\/pricing\/(prices|policy|rules|changes)$/,
  /^\/secure\/products\/pack-check$/,
  /^\/secure\/(checklists|stock-audits|review|compliance|todos|feedback)$/,
  /^\/secure\/quality\/audit$/,
  /^\/secure\/purchases\/invoices\/list$/,
  /^\/secure\/kpi\/(mine|rate)$/,
  /^\/secure\/customers\/cust\/view\/\d+$/,
  /^\/secure\/dashboard$/,
];

const source = readFileSync(join(__dirname, 'alert-kinds.ts'), 'utf-8');
const links = Array.from(source.matchAll(/['`](\/secure\/[^'`]+)['`]/g)).map((m) => m[1]);
const bare = (l: string) => l.replace(/\$\{[^}]*\}/g, '1').split('?')[0];

describe('the links in the alerts', () => {
  it('finds the links', () => {
    expect(links.length).toBeGreaterThan(20);
  });

  it('all lead to a page the app has', () => {
    const unknown = Array.from(new Set(links)).filter((l) => !PAGES.some((p) => p.test(bare(l))));
    expect(unknown).toEqual([]);                                                              // a link no page answers to
  });

  it('an alert about one thing links to that thing', () => {
    // a report, a to-do, a commitment, a staff member, a pass
    expect(source.match(/\/secure\/feedback\?id=\$\{r\.id\}/g)?.length).toBe(3);                // reply, waiting, closing
    expect(source.match(/\/secure\/todos\?id=\$\{r\.id\}/g)?.length).toBe(4);                   // soon, due, overdue, escalated
    expect(source).toContain('/secure/commitments/${r.id}');
    expect(source).toContain('/secure/customers/cust/view/${r.customer_id}');                   // the customer to try again
    expect(source).toContain('/secure/settings/users/edit/${r.user_id}');
    expect(source).toContain('/secure/store/stock/passes/${r.id}');
  });

  it('opens the right tab or month of the GST page, and the right stock page', () => {
    expect(source).toContain("/secure/gst-filing?tab=rates");
    expect(source).toContain('/secure/gst-filing?tab=summary&month=${month}');
    expect(source).toContain("/secure/store/stock/expiry");
    expect(source).toContain("/secure/store/stock/adjust");
  });

  it('sends the many-customers alerts to the audit log, where the evidence is', () => {
    expect(source).not.toContain("/secure/customers/cust/list");
  });
});
