import { canSeeRequest, cleanSlipLines, forRequesterView, lineComment } from './request-slip-rules';

describe('cleanSlipLines', () => {
  it('keeps distinct products as they are', () => {
    expect(cleanSlipLines([{ productid: 1, qty: 2 }, { productid: 2, qty: 3 }]).map((l) => [l.productid, l.qty])).toEqual([[1, 2], [2, 3]]);
  });
  it('adds the quantities of the same product and joins the notes', () => {
    const out = cleanSlipLines([{ productid: 1, qty: 2, note: 'red' }, { productid: 1, qty: 3, note: 'blue' }]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ productid: 1, qty: 5, note: 'red; blue' });
  });
  it('treats the same typed name as one line whatever the case and spacing', () => {
    expect(cleanSlipLines([{ requestedname: 'Revital  H', qty: 1 }, { requestedname: 'revital h', qty: 2 }])).toHaveLength(1);
  });
  it('needs a product or a name, and a whole quantity of at least 1', () => {
    expect(() => cleanSlipLines([{ qty: 1 }])).toThrow(/Line 1/);
    expect(() => cleanSlipLines([{ productid: 1, qty: 0 }])).toThrow(/at least 1/);
    expect(() => cleanSlipLines([{ productid: 1, qty: 1.5 }])).toThrow(/whole number/);
    expect(() => cleanSlipLines([])).toThrow(/at least one/);
  });
  it('ignores a typed name when a product is chosen', () => {
    expect(cleanSlipLines([{ productid: 4, requestedname: 'x', qty: 1 }])[0].requestedname).toBeUndefined();
  });
});

describe('lineComment', () => {
  it('joins the shared comment and the line note', () => {
    expect(lineComment('for Mrs X', 'strip of 10')).toBe('for Mrs X | strip of 10');
    expect(lineComment('', 'only line')).toBe('only line');
    expect(lineComment(undefined, undefined)).toBeUndefined();
  });
});

describe('who sees a request', () => {
  it('the creator, or anyone in the store it was raised for', () => {
    expect(canSeeRequest({ createdby: 5, storeid: 2 }, 5, [])).toBe(true);
    expect(canSeeRequest({ createdby: 9, storeid: 2 }, 5, [2, 3])).toBe(true);
    expect(canSeeRequest({ createdby: 9, storeid: 4 }, 5, [2, 3])).toBe(false);
    expect(canSeeRequest({ createdby: 9, storeid: null }, 5, [2])).toBe(false);
  });
  it('a requester never sees the vendor or notes, and sees a customer only on their own requests', () => {
    const rows: any[] = [
      { id: 1, createdby: 5, vendorid: 7, vendor: { name: 'V' }, notes: 'n', customername: 'A', customerphone: '1' },
      { id: 2, createdby: 9, vendorid: 7, vendor: { name: 'V' }, notes: 'n', customername: 'B', customerphone: '2' },
    ];
    const [mine, other]: any[] = forRequesterView(rows, 5);
    expect(mine).toMatchObject({ vendor: null, vendorid: null, notes: null, customername: 'A', customerphone: '1' });
    expect(other).toMatchObject({ vendor: null, notes: null, customername: null, customerphone: null });
  });
});
