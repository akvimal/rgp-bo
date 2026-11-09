import { Subject, throwError } from 'rxjs';
import { ProductStockHistoryComponent } from './product-stock-history.component';

const make = (get: (url: string) => any) => new ProductStockHistoryComponent({ get } as any);
const open = (c: ProductStockHistoryComponent, id: number, title = 'Pantoprazole') => {
  c.product = { id, title };
  c.ngOnChanges({ product: {} as any });
};

describe('ProductStockHistoryComponent', () => {
  it('loads the history of the chosen product and adds up the batches', () => {
    const calls: string[] = [];
    const answer = new Subject<any>();
    const c = make((url) => { calls.push(url); return answer; });
    open(c, 7);
    expect(calls[0]).toMatch(/\/stock2\/7$/);
    expect(c.loading).toBeTrue();
    answer.next({
      purchases: [{ purchased: '100', sold: '60', adjusted: '-5', balance: '35' }, { purchased: 50, sold: 10, adjusted: 0, balance: 40 }],
      sales: [{ sale_month: '2020-01-01' }, { sale_month: new Date().toISOString() }],
      customers: [{ sale_month: '2020-01-01' }],
    });
    expect(c.loading).toBeFalse();
    expect(c.totals).toEqual({ purchased: 150, sold: 70, adjusted: -5, balance: 75 });
    expect(c.data.sales[0].long).toBeTrue();      // more than six months back
    expect(c.data.sales[1].long).toBeFalse();
    expect(c.data.customers[0].long).toBeTrue();
  });

  it('does not count the empty row a never-bought product comes back as', () => {
    const answer = new Subject<any>();
    const c = make(() => answer);
    open(c, 9);
    answer.next({ purchases: [{ invoice_no: null, batch: null, purchased: null, sold: 0, adjusted: 0, balance: 0 }], sales: [], customers: [] });
    expect(c.data.purchases.length).toBe(0);
    expect(c.totals).toEqual({ purchased: 0, sold: 0, adjusted: 0, balance: 0 });
    const real = new Subject<any>();
    const d = make(() => real);
    open(d, 10);
    real.next({ purchases: [{ invoice_no: 'INV-1', batch: 'B1', purchased: 0, sold: 0, adjusted: 0, balance: 0 }], sales: [], customers: [] });
    expect(d.data.purchases.length).toBe(1);        // a real batch that happens to show 0 is kept
  });

  it('shows nothing and asks for nothing when closed', () => {
    let asked = 0;
    const c = make(() => { asked++; return new Subject<any>(); });
    c.product = null;
    c.ngOnChanges({ product: {} as any });
    expect(asked).toBe(0);
    expect(c.data).toBeNull();
    expect(c.totals).toEqual({ purchased: 0, sold: 0, adjusted: 0, balance: 0 });
  });

  it('ignores a slow answer for a product that is no longer the one chosen', () => {
    const answers: Subject<any>[] = [];
    const c = make(() => { const s = new Subject<any>(); answers.push(s); return s; });
    open(c, 1, 'First');
    open(c, 2, 'Second');
    answers[1].next({ purchases: [{ purchased: 5, sold: 0, adjusted: 0, balance: 5 }], sales: [], customers: [] });
    answers[0].next({ purchases: [{ purchased: 999, sold: 0, adjusted: 0, balance: 999 }], sales: [], customers: [] });
    expect(c.totals.purchased).toBe(5);
  });

  it('says so when the person may not see stock history, and shows other failures', () => {
    const denied = make(() => throwError({ status: 403 }));
    open(denied, 3);
    expect(denied.error).toMatch(/do not have access/);
    expect(denied.loading).toBeFalse();
    const broken = make(() => throwError({ status: 500, error: { message: 'Something broke' } }));
    open(broken, 3);
    expect(broken.error).toBe('Something broke');
  });

  it('tells the list when it is closed', () => {
    const c = make(() => new Subject<any>());
    let closed = 0;
    c.closed.subscribe(() => closed++);
    c.close();
    expect(closed).toBe(1);
  });
});
