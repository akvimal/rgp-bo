import { canReporterClose, canReporterReopen, cleanMessage, cleanReport, flagsAfter, statusAfterReporterReply, statusAfterStaffReply, statusProblem, resolveProblem, ticketFromText, ticketNo, autoCloseReason, closeNote, daysUntilClose, idleDaysBetween, needsReminder, reopenAllowed, STATE_OF, STATUSES_OF, STATUSES, stateLabel, nextStep, reporterCloseNote } from './feedback-rules';

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
    expect(canReporterClose('NEW')).toBe(true);        // withdrawn while open
    expect(canReporterClose('WAITING')).toBe(true);
    expect(canReporterClose('CLOSED')).toBe(false);
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

  it('a resolution has a type, the words the reporter reads, and sets the status', () => {
    expect(resolveProblem({})).toMatchObject({ problem: expect.stringMatching(/choose/i) });
    expect(resolveProblem({ code: 'fixed' })).toMatchObject({ problem: expect.stringMatching(/write/i) });
    expect(resolveProblem({ code: 'not_planned', note: '  ' })).toMatchObject({ problem: expect.stringMatching(/why/i) });
    expect(resolveProblem({ code: 'duplicate', note: 'Same as the other' })).toMatchObject({ problem: expect.stringMatching(/number/i) });
    expect(resolveProblem({ code: 'fixed', note: 'Fixed in the update' })).toEqual({ code: 'fixed', status: 'ANSWERED', note: 'Fixed in the update' });
    expect(resolveProblem({ code: 'not_a_bug', note: 'It is meant to work this way' })).toMatchObject({ status: 'ANSWERED' });
    expect(resolveProblem({ code: 'not_planned', note: 'Out of scope' })).toMatchObject({ status: 'DECLINED' });
    expect(resolveProblem({ code: 'duplicate', note: 'See FB-4', duplicate_of: 4 })).toMatchObject({ status: 'DUPLICATE' });
    expect(resolveProblem({ code: 'bogus', note: 'x' })).toMatchObject({ problem: expect.stringMatching(/choose/i) });
  });

  it('a report goes by a number like FB-12, which the search box understands', () => {
    expect(ticketNo(12)).toBe('FB-12');
    expect(ticketFromText('FB-12')).toBe(12);
    expect(ticketFromText(' fb12 ')).toBe(12);
    expect(ticketFromText('12')).toBe(12);
    expect(ticketFromText('print button')).toBeNull();
    expect(ticketFromText('')).toBeNull();
  });

  it('closes by itself: a question nobody answered after 7 days, a finished report after 7 quiet days; nothing else', () => {
    expect(autoCloseReason('WAITING', 6.9)).toBeNull();
    expect(autoCloseReason('WAITING', 7)).toBe('no_response');
    expect(autoCloseReason('ANSWERED', 7)).toBe('ended_quiet');
    expect(autoCloseReason('DECLINED', 9)).toBe('ended_quiet');
    expect(autoCloseReason('DUPLICATE', 9)).toBe('ended_quiet');
    expect(autoCloseReason('ANSWERED', 6)).toBeNull();
    for (const s of ['NEW', 'IN_PROGRESS', 'PLANNED', 'CLOSED'] as const) expect(autoCloseReason(s, 400)).toBeNull();   // being worked on, planned, or already closed
    expect(closeNote('no_response')).toMatch(/no reply for 7 days/);
    expect(closeNote('ended_quiet')).toMatch(/nothing more for 7 days/);
  });

  it('reminds the reporter of a waiting question from day 3 until it closes', () => {
    expect(needsReminder('WAITING', 2.9)).toBe(false);
    expect(needsReminder('WAITING', 3)).toBe(true);
    expect(needsReminder('WAITING', 6.9)).toBe(true);
    expect(needsReminder('WAITING', 7)).toBe(false);
    expect(needsReminder('ANSWERED', 5)).toBe(false);
    expect(daysUntilClose('WAITING', 4.2)).toBe(3);
    expect(daysUntilClose('ANSWERED', 0)).toBe(7);
    expect(daysUntilClose('IN_PROGRESS', 1)).toBeNull();
    expect(daysUntilClose('WAITING', 20)).toBe(0);
  });

  it('can be reopened inside 14 days of closing; after that a follow-up is raised', () => {
    const now = new Date('2026-12-01T10:00:00Z');
    const ago = (d: number) => new Date(now.getTime() - d * 86400000);
    expect(reopenAllowed('CLOSED', ago(13.9), now)).toBe(true);
    expect(reopenAllowed('CLOSED', ago(14.1), now)).toBe(false);
    expect(reopenAllowed('CLOSED', null, now)).toBe(true);          // closed before the date was kept
    expect(reopenAllowed('ANSWERED', ago(400), now)).toBe(true);    // not closed: no window
    expect(idleDaysBetween(ago(2), now)).toBeCloseTo(2, 5);
    expect(idleDaysBetween(null, now)).toBe(0);
  });

  it('says who owes the next word', () => {
    expect(flagsAfter('reporter')).toEqual({ awaiting_staff: true, reporter_unread: false });
    expect(flagsAfter('staff')).toEqual({ awaiting_staff: false, reporter_unread: true });
  });
});

describe('the four states', () => {
  it('every status belongs to exactly one state, and the lists agree', () => {
    for (const st of STATUSES) expect(STATUSES_OF[STATE_OF[st]]).toContain(st);
    expect(Object.values(STATUSES_OF).flat().sort()).toEqual([...STATUSES].sort());
  });
  it('names the states for the reporter and for the people who answer', () => {
    expect(stateLabel('WAITING', true)).toBe('Waiting on you');
    expect(stateLabel('WAITING', false)).toBe('Waiting on the reporter');
    expect(stateLabel('IN_PROGRESS', true)).toBe('Open');
    expect(stateLabel('DECLINED', false)).toBe('Done');
    expect(stateLabel('CLOSED', true)).toBe('Closed');
  });
  it('says what happens next', () => {
    expect(nextStep('WAITING', true, 'Anu', 3, true)).toContain('Waiting for your reply');
    expect(nextStep('WAITING', false, 'Anu', 1, true)).toBe('Waiting for Anu. It closes by itself in 1 day unless they write.');
    expect(nextStep('ANSWERED', true, 'Anu', 7, true, 'Fixed')).toContain('This solved it');
    expect(nextStep('CLOSED', true, 'Anu', null, false)).toContain('follow-up');
  });
  it('words a close by the reporter by where the report stood', () => {
    expect(reporterCloseNote('ANSWERED')).toContain('solved');
    expect(reporterCloseNote('IN_PROGRESS')).toContain('withdrawn');
    expect(reporterCloseNote('DECLINED')).toBe('Status: Closed by the reporter');
  });
});
