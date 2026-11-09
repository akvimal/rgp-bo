import { fakeAsync, tick } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { SaleAlternativesComponent } from './sale-alternatives.component';

/** the dialog's logic without a screen: a fake HttpClient records what was asked and answers from a table */
function make(answers: (url: string, params: any) => any) {
  const calls: { url: string; params: any }[] = [];
  const http: any = { get: (url: string, o: any) => { calls.push({ url, params: o?.params }); return answers(url, o?.params); } };
  const c = new SaleAlternativesComponent(http, { selectedStoreId: 1 } as any);
  return { c, calls };
}

describe('SaleAlternativesComponent: brand dictionary', () => {
  it('opens, and offers the brand search only when a dictionary is loaded', () => {
    const on = make(() => of({ available: true, results: [] }));
    on.c.open();
    expect(on.c.show).toBeTrue();
    expect(on.c.dictionary).toBeTrue();
    const off = make(() => of({ available: false, results: [] }));
    off.c.open();
    expect(off.c.dictionary).toBeFalse();
    const broken = make(() => throwError({ status: 500 }));
    broken.c.open();
    expect(broken.c.dictionary).toBeFalse();
  });

  it('opened from the product search, it looks up the brand typed there straight away', fakeAsync(() => {
    const { c, calls } = make((url: string) => of(url.endsWith('/brands') ? { available: true, results: [{ id: 3, brand: 'Telma 40' }] } : {}));
    c.open('  telma  ');
    tick(400);
    expect(c.brandText).toBe('telma');
    expect(calls.filter((x) => x.params.q === 'telma').length).toBe(1);
    expect(c.brandResults.length).toBe(1);
    const short = make(() => of({ available: true, results: [] }));
    short.c.open('te');
    tick(400);
    expect(short.calls.every((x) => x.params.q === '')).toBeTrue();      // too short to search: only the availability check
  }));

  it('waits for three letters and a short pause before asking the dictionary', fakeAsync(() => {
    const { c, calls } = make(() => of({ available: true, results: [{ id: 1, brand: 'Augmentin DUO', composition: 'X' }] }));
    c.brandText = 'au';
    c.brandTyped();
    tick(500);
    expect(calls.length).toBe(0);
    expect(c.brandResults).toEqual([]);
    c.brandText = 'augm';
    c.brandTyped();
    tick(100);
    expect(calls.length).toBe(0);                                  // still within the pause
    tick(300);
    expect(calls.length).toBe(1);
    expect(calls[0].params.q).toBe('augm');
    expect(c.brandResults.length).toBe(1);
    expect(c.brandSearched).toBeTrue();
  }));

  it('keeps only the answer for the latest text', fakeAsync(() => {
    const answers: Subject<any>[] = [];
    const { c } = make(() => { const s = new Subject<any>(); answers.push(s); return s; });
    c.brandText = 'augmentin'; c.brandTyped(); tick(300);
    c.brandText = 'augmentin duo'; c.brandTyped(); tick(300);
    answers[1].next({ results: [{ id: 2, brand: 'Augmentin DUO 500' }] });
    answers[0].next({ results: [{ id: 1, brand: 'Augmentin 1 g vial' }] });          // a slow answer for the older text
    expect(c.brandResults.map((r) => r.id)).toEqual([2]);
  }));

  it('shows what the shop has for a picked brand, with the store, and clears the list', () => {
    const { c, calls } = make(() => of({ status: 'OK', asked: { title: 'Augmentin DUO', fromDictionary: true, form: 'tablet' }, same: [{ productid: 9 }], otherForms: [], orderIdeas: [] }));
    c.brandResults = [{ id: 5 }];
    c.pickBrand({ id: 5 });
    expect(calls[0].url).toMatch(/\/sale-alternatives\/brand$/);
    expect(calls[0].params).toEqual({ brandid: '5', storeid: '1' });
    expect(c.r.same.length).toBe(1);
    expect(c.brandResults).toEqual([]);
    expect(c.loading).toBeFalse();
    expect(c.askedFormLabel).toBe('Tablet');
  });

  it('says so when a brand cannot be looked up, and lists the not-stocked names', () => {
    const { c } = make(() => throwError({ error: { message: 'That brand is not in the dictionary.' } }));
    c.pickBrand({ id: 1 });
    expect(c.error).toBe('That brand is not in the dictionary.');
    expect(c.loading).toBeFalse();
    c.r = { notStocked: [{ title: 'A' }, { title: 'B' }] };
    expect(c.notStockedNames).toBe('A, B');
  });

  it('adds a chosen product to the bill and closes; closing forgets what was typed', () => {
    const { c } = make(() => of({}));
    const picked: any[] = [];
    c.pick.subscribe((p) => picked.push(p));
    c.show = true;
    c.add({ productid: 42 });
    expect(picked).toEqual([{ productid: 42 }]);
    expect(c.show).toBeFalse();
    c.brandText = 'augm'; c.brandResults = [{ id: 1 }]; c.r = { x: 1 }; c.error = 'x';
    c.clear();
    expect(c.brandText).toBe('');
    expect(c.brandResults).toEqual([]);
    expect(c.r).toBeNull();
    expect(c.error).toBe('');
  });

  it('names a form, and says when it is not recorded', () => {
    const { c } = make(() => of({}));
    expect(c.formLabel('tablet_sr')).toBe('Tablet, sustained release');
    expect(c.formLabel(null)).toBe('form not recorded');
  });
});
