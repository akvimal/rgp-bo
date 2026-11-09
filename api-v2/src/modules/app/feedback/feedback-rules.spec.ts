import { canReporterClose, canReporterReopen, cleanMessage, cleanReport, flagsAfter, statusAfterReporterReply, statusAfterStaffReply, statusProblem } from './feedback-rules';

describe('feedback rules', () => {
  const problem = { kind: 'problem', title: 'Bill total is wrong', module_id: 'nav-sales', module_title: 'Sales and billing', feature: 'Print a bill', details: { what: 'The total is 10 less', expected: 'The sum of the lines' }, impact: 'blocks', context: { route: '/secure/sales/pos/new?token=abc#x', version: '2026.11', browser: 'Chrome' } };

  it('accepts a good problem and keeps the screen without what was typed on it', () => {
    const r = cleanReport(problem);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.context.route).toBe('/secure/sales/pos/new');
      expect(r.value.impact).toBe('blocks');
      expect(r.value.details.what).toMatch(/10 less/);
    }
  });

  it('asks for the one thing that is missing, in a sentence', () => {
    expect(cleanReport({ ...problem, kind: 'nonsense' })).toEqual({ ok: false, message: expect.stringMatching(/what this is/i) });
    expect(cleanReport({ ...problem, title: 'ab' })).toEqual({ ok: false, message: expect.stringMatching(/title/i) });
    expect(cleanReport({ ...problem, details: { what: 'x' } })).toEqual({ ok: false, message: expect.stringMatching(/what happened/i) });
    expect(cleanReport({ kind: 'question', title: 'How do I close a shift', details: {} })).toEqual({ ok: false, message: expect.stringMatching(/question/i) });
    expect(cleanReport({ kind: 'suggestion', title: 'Add a colour', details: { benefit: 'nicer' } })).toEqual({ ok: false, message: expect.stringMatching(/trying to do/i) });
  });

  it('a suggestion needs the goal and has no impact; a question has no expected result', () => {
    const s = cleanReport({ kind: 'suggestion', title: 'Print labels', details: { goal: 'Put a label on each shelf', benefit: 'faster' }, impact: 'blocks' });
    expect(s.ok && s.value.impact).toBeNull();
    const q = cleanReport({ kind: 'question', title: 'How to close', details: { what: 'How do I close the shift?', expected: 'ignored' } });
    expect(q.ok && q.value.details.expected).toBeUndefined();
  });

  it('defaults a missing or unknown impact to minor, and an unusable module id to none', () => {
    const r = cleanReport({ ...problem, impact: 'huge', module_id: 'bad id!' });
    expect(r.ok && r.value.impact).toBe('minor');
    expect(r.ok && r.value.moduleId).toBeNull();
    const none = cleanReport({ ...problem, module_title: '' });
    expect(none.ok && none.value.moduleTitle).toBe('Not sure');
  });

  it('strips control characters and cuts long text', () => {
    const r = cleanReport({ ...problem, title: 'Bill\u0000 total\u0007 wrong' + 'x'.repeat(300) });
    expect(r.ok && r.value.title.length).toBe(120);
    expect(r.ok && r.value.title).not.toMatch(/[\u0000\u0007]/);
  });

  it('a reply must say something', () => {
    expect(cleanMessage('   ')).toBeNull();
    expect(cleanMessage(undefined)).toBeNull();
    expect(cleanMessage(' ok ')).toBe('ok');
  });

  it('moves the status as the reporter and the managers write', () => {
    expect(statusAfterReporterReply('WAITING')).toBe('IN_PROGRESS');
    expect(statusAfterReporterReply('ANSWERED')).toBe('IN_PROGRESS');
    expect(statusAfterReporterReply('NEW')).toBe('NEW');
    expect(statusAfterReporterReply('CLOSED')).toBe('CLOSED_REFUSED');
    expect(statusAfterStaffReply('NEW', false)).toBe('IN_PROGRESS');
    expect(statusAfterStaffReply('IN_PROGRESS', true)).toBe('WAITING');
    expect(statusAfterStaffReply('PLANNED', false)).toBe('PLANNED');
  });

  it('only a settled report can be closed or reopened by the reporter', () => {
    expect(canReporterClose('ANSWERED')).toBe(true);
    expect(canReporterClose('PLANNED')).toBe(true);
    expect(canReporterClose('NEW')).toBe(false);
    expect(canReporterReopen('CLOSED')).toBe(true);
    expect(canReporterReopen('DECLINED')).toBe(true);
    expect(canReporterReopen('IN_PROGRESS')).toBe(false);
  });

  it('a status change needs its words', () => {
    expect(statusProblem({ status: 'ANSWERED' })).toMatch(/answer/i);
    expect(statusProblem({ status: 'ANSWERED', resolution: 'Use the Print button' })).toBeNull();
    expect(statusProblem({ status: 'DECLINED', resolution: '' })).toMatch(/why/i);
    expect(statusProblem({ status: 'DUPLICATE' })).toMatch(/number/i);
    expect(statusProblem({ status: 'DUPLICATE', duplicate_of: 12 })).toBeNull();
    expect(statusProblem({ status: 'NEW' })).toMatch(/choose/i);
    expect(statusProblem({ status: 'PLANNED' })).toBeNull();
  });

  it('says who owes the next word', () => {
    expect(flagsAfter('reporter')).toEqual({ awaiting_staff: true, reporter_unread: false });
    expect(flagsAfter('staff')).toEqual({ awaiting_staff: false, reporter_unread: true });
  });
});
