import { Subject, throwError } from 'rxjs';
import { PurchaseHistoryComponent } from './purchase-history.component';

const make = (get: (url: string, o?: any) => any) => new PurchaseHistoryComponent({ get } as any);
const open = (c: PurchaseHistoryComponent, id: number, invoiceId: number | null = null, title = 'Pantoprazole') => {
  c.product = { id, title };
  c.invoiceId = invoiceId;
  c.ngOnChanges({ product: {} as any });
};

describe('PurchaseHistoryComponent', () => {
  it('asks for the purchases of the product and leaves out the invoice it is opened from', () => {
    const calls: { url: string; o: any }[] = [];
    const answer = new Subject<any>();
    const c = make((url, o) => { calls.push({ url, o }); return answer; });
    open(c, 7, 42);
    expect(calls[0].url).toMatch(/\/purchaseitems\/history\/7$/);
    expect(calls[0].o.params).toEqual({ exclude: '42' });
    expect(c.loading).toBeTrue();
    answer.next({ lines: [{ id: 1, invoice_date: '2026-10-01', doc_no: 'INV-1', vendor: 'Alpha' }], summary: { count: 1, last: { rate: 63, vendor: 'Alpha', date: '2026-10-01' } }, limit: 100 });
    expect(c.loading).toBeFalse();
    expect(c.data.lines.length).toBe(1);
    expect(c.data.summary.last.rate).toBe(63);
  });

  it('asks without an exclusion when there is no invoice', () => {
    const calls: any[] = [];
    const c = make((_u, o) => { calls.push(o); return new Subject<any>(); });
    open(c, 3, null);
    expect(calls[0].params).toEqual({});
  });

  it('a product never bought shows an empty list, not an error', () => {
    const answer = new Subject<any>();
    const c = make(() => answer);
    open(c, 9);
    answer.next({ lines: [], summary: { count: 0, last: null, lowest: null, highest: null }, limit: 100 });
    expect(c.data.lines).toEqual([]);
    expect(c.error).toBe('');
  });

  it('ignores a slow answer for a product that is no longer chosen', () => {
    const first = new Subject<any>(), second = new Subject<any>();
    const answers = [first, second];
    const c = make(() => answers.shift());
    open(c, 1);
    open(c, 2);
    first.next({ lines: [{ id: 1 }], summary: {}, limit: 100 });          // the answer for product 1 arrives late
    expect(c.data).toBeNull();
    second.next({ lines: [{ id: 2 }, { id: 3 }], summary: {}, limit: 100 });
    expect(c.data.lines.length).toBe(2);
  });

  it('says so when the role has no access, and shows the server reason for any other failure', () => {
    const c = make(() => throwError({ status: 403 }));
    open(c, 5);
    expect(c.error).toMatch(/do not have access/);
    expect(c.loading).toBeFalse();
    const d = make(() => throwError({ status: 500, error: { message: 'Say which product.' } }));
    open(d, 5);
    expect(d.error).toBe('Say which product.');
  });

  it('closing clears it, and closes through the output', () => {
    const c = make(() => new Subject<any>());
    open(c, 4);
    let closed = 0;
    c.closed.subscribe(() => closed++);
    c.close();
    expect(closed).toBe(1);
    c.product = null;
    c.ngOnChanges({ product: {} as any });
    expect(c.data).toBeNull();
    expect(c.loading).toBeFalse();
  });
});
