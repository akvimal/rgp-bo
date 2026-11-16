import { BadRequestException } from '@nestjs/common';
import { buildSaleReportQuery, MAX_REPORT_ROWS } from './sale-report-query';

const ok = { report: 'sale', begin: '2026-11-01', end: '2026-11-15' };

describe('the sale report query', () => {
  it('takes the dates as parameters and limits the rows to the stores given', () => {
    const q = buildSaleReportQuery(ok, [3, 4]);
    expect(q.params).toEqual(['2026-11-01', '2026-11-15', [3, 4]]);
    expect(q.sql).toContain('s.bill_date between $1::date and ($2::date + 1)');
    expect(q.sql).toContain('coalesce(s.store_id, ss.store_id) = any($3::int[])');
  });

  it('has no store limit only when the caller says so (a login with no business), and reads nothing for an empty list', () => {
    expect(buildSaleReportQuery(ok, null).sql).not.toContain('any(');
    expect(buildSaleReportQuery(ok, []).params[2]).toEqual([]);
  });

  it('puts the category and each property into parameters, in order', () => {
    const q = buildSaleReportQuery({ ...ok, product: { category: 'Tablet', props: [{ id: 'brand', label: 'Brand', value: 'Acme' }, { id: 'form', value: 'strip' }] } }, [1]);
    expect(q.params).toEqual(['2026-11-01', '2026-11-15', [1], 'Tablet', 'brand', 'Acme', 'form', 'strip']);
    expect(q.sql).toContain('p.category = $4');
    expect(q.sql).toContain('p.more_props->>$5 = $6');
    expect(q.sql).toContain('p.more_props->>$7 = $8');
  });

  it('skips an empty category and empty or unticked property values, as the old report did', () => {
    const q = buildSaleReportQuery({ ...ok, product: { category: '', props: [{ id: 'a', value: '' }, { id: 'b', value: false }, { id: 'c', value: null }] } }, [1]);
    expect(q.params).toEqual(['2026-11-01', '2026-11-15', [1]]);
  });

  it('never puts anything the caller sent into the SQL text', () => {
    const evil = "x'; drop table sale; --";
    const q = buildSaleReportQuery({ ...ok, product: { category: evil, props: [{ id: evil, value: evil }] } }, [1]);
    expect(q.sql).not.toContain('drop table');
    expect(q.sql).not.toContain(evil);
    expect(q.params).toContain(evil);
  });

  it('asks for one row more than the cap, so a search that is too big can be told from one that just fits', () => {
    expect(buildSaleReportQuery(ok, [1]).sql).toContain(`limit ${MAX_REPORT_ROWS + 1}`);
    expect(MAX_REPORT_ROWS).toBe(50000);
  });

  it('refuses dates that are not dates, however they are dressed', () => {
    for (const begin of ["2026-11-01'; drop table sale; --", '2026-13-01', '2026-02-31', '01/11/2026', '', null, undefined, 20261101, { $gt: '' }]) {
      expect(() => buildSaleReportQuery({ ...ok, begin }, [1])).toThrow(BadRequestException);
    }
    expect(() => buildSaleReportQuery({ ...ok, end: "2026-11-15' or '1'='1" }, [1])).toThrow(BadRequestException);
  });

  it('refuses a range that runs backwards, a missing body and another report', () => {
    expect(() => buildSaleReportQuery({ ...ok, begin: '2026-11-16' }, [1])).toThrow(BadRequestException);
    expect(() => buildSaleReportQuery(undefined, [1])).toThrow(BadRequestException);
    expect(() => buildSaleReportQuery([], [1])).toThrow(BadRequestException);
    expect(() => buildSaleReportQuery({ ...ok, report: 'purchase' }, [1])).toThrow(BadRequestException);
  });

  it('refuses a product filter of the wrong shape or an oversized one', () => {
    expect(() => buildSaleReportQuery({ ...ok, product: 'Tablet' }, [1])).toThrow(BadRequestException);
    expect(() => buildSaleReportQuery({ ...ok, product: { props: 'x' } }, [1])).toThrow(BadRequestException);
    expect(() => buildSaleReportQuery({ ...ok, product: { category: { a: 1 } } }, [1])).toThrow(BadRequestException);
    expect(() => buildSaleReportQuery({ ...ok, product: { props: [null] } }, [1])).toThrow(BadRequestException);
    expect(() => buildSaleReportQuery({ ...ok, product: { category: 'x'.repeat(201) } }, [1])).toThrow(BadRequestException);
    const many = Array.from({ length: 21 }, (_, i) => ({ id: 'p' + i, value: 'v' }));
    expect(() => buildSaleReportQuery({ ...ok, product: { props: many } }, [1])).toThrow(BadRequestException);
  });
});
