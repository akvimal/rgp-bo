/** App feedback rules: the kinds, the statuses and who may move a report where, and the checking of what a person sends. Pure, so it is tested without a database. */
export const KINDS = ['problem', 'question', 'suggestion', 'data'] as const;
export type FeedbackKind = (typeof KINDS)[number];
export const KIND_LABEL: Record<FeedbackKind, string> = { problem: 'Something is wrong', question: 'A question', suggestion: 'A suggestion', data: 'Wrong data' };

export const IMPACTS = ['blocks', 'workaround', 'minor'] as const;
export type Impact = (typeof IMPACTS)[number];

export const STATUSES = ['NEW', 'IN_PROGRESS', 'WAITING', 'ANSWERED', 'PLANNED', 'DECLINED', 'DUPLICATE', 'CLOSED'] as const;
export type FeedbackStatus = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<FeedbackStatus, string> = {
  NEW: 'Sent', IN_PROGRESS: 'Looking into it', WAITING: 'Waiting for your reply', ANSWERED: 'Answered', PLANNED: 'Planned',
  DECLINED: 'Not planned', DUPLICATE: 'Already reported', CLOSED: 'Closed',
};
/** what a manager may set (a report starts as NEW by itself) */
export const STAFF_STATUSES: FeedbackStatus[] = ['IN_PROGRESS', 'WAITING', 'ANSWERED', 'PLANNED', 'DECLINED', 'DUPLICATE', 'CLOSED'];
/** these end the matter for now: the date and the person are kept */
export const FINISHED: FeedbackStatus[] = ['ANSWERED', 'DECLINED', 'DUPLICATE', 'CLOSED'];
/** these must say why or what (the reporter reads it) */
export const NEEDS_TEXT: FeedbackStatus[] = ['ANSWERED', 'DECLINED'];

export const MAX_PER_DAY = 20;
export const MAX_FILES = 3;

/** one line of text: no control characters, trimmed, cut to the limit */
export const clean = (v: any, max: number): string => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
/** several lines: line breaks kept, the rest as clean() */
const cleanBlock = (v: any, max: number): string => clean(String(v ?? '').replace(/\r\n?/g, '\n'), max);

export interface ReportInput {
  kind: FeedbackKind;
  moduleId: string | null;
  moduleTitle: string;
  feature: string | null;
  title: string;
  details: { what?: string; expected?: string; goal?: string; benefit?: string };
  impact: Impact | null;
  context: { route: string | null; version: string | null; browser: string | null };
}

/** check what a person sent; the first problem comes back as a sentence they can act on */
export function cleanReport(b: any): { ok: true; value: ReportInput } | { ok: false; message: string } {
  const kind = String(b?.kind ?? '') as FeedbackKind;
  if (!KINDS.includes(kind)) return { ok: false, message: 'Say what this is: something wrong, a question, a suggestion or wrong data.' };
  const title = clean(b?.title, 120);
  if (title.length < 5) return { ok: false, message: 'Give it a short title (at least 5 letters).' };
  const moduleIdRaw = clean(b?.module_id, 60);
  const moduleId = /^[A-Za-z0-9_-]+$/.test(moduleIdRaw) ? moduleIdRaw : null;
  const moduleTitle = clean(b?.module_title, 80) || 'Not sure';
  const feature = clean(b?.feature, 100) || null;
  const d = b?.details ?? {};
  const details: ReportInput['details'] = {};
  if (kind === 'suggestion') {
    details.goal = cleanBlock(d.goal, 1500);
    details.benefit = cleanBlock(d.benefit, 1000) || undefined;
    if (details.goal.length < 5) return { ok: false, message: 'Say what you are trying to do.' };
  } else {
    details.what = cleanBlock(d.what, 1500);
    if (details.what.length < 5) return { ok: false, message: kind === 'question' ? 'Write your question.' : 'Say what happened.' };
    if (kind !== 'question') details.expected = cleanBlock(d.expected, 1000) || undefined;
  }
  const impact: Impact | null = kind === 'problem' || kind === 'data'
    ? ((IMPACTS as readonly string[]).includes(String(b?.impact)) ? (b.impact as Impact) : 'minor')
    : null;
  // the screen, not what was typed on it: anything after ? or # is dropped
  const route = clean(String(b?.context?.route ?? '').split(/[?#]/)[0], 200) || null;
  return {
    ok: true,
    value: { kind, moduleId, moduleTitle, feature, title, details, impact, context: { route, version: clean(b?.context?.version, 30) || null, browser: clean(b?.context?.browser, 200) || null } },
  };
}

/** a reply or note: at least a word, not a page */
export function cleanMessage(v: any): string | null {
  const m = cleanBlock(v, 2000);
  return m.length >= 1 ? m : null;
}

// ------------------------------------------------------------------ who moves what
/** the reporter writes: a report waiting for them, or already answered, goes back to being looked into; a closed one must be reopened first */
export function statusAfterReporterReply(s: FeedbackStatus): FeedbackStatus | 'CLOSED_REFUSED' {
  if (s === 'CLOSED') return 'CLOSED_REFUSED';
  return s === 'WAITING' || s === 'ANSWERED' ? 'IN_PROGRESS' : s;
}

/** a manager replies: a new report is now being looked into; "wait" hands the ball back to the reporter */
export function statusAfterStaffReply(s: FeedbackStatus, wait: boolean): FeedbackStatus {
  if (wait) return 'WAITING';
  return s === 'NEW' ? 'IN_PROGRESS' : s;
}

export const canReporterClose = (s: FeedbackStatus): boolean => s === 'ANSWERED' || s === 'PLANNED';
export const canReporterReopen = (s: FeedbackStatus): boolean => s === 'ANSWERED' || s === 'CLOSED' || s === 'DECLINED' || s === 'DUPLICATE';

/** a manager's status change: the problem, if any, as a sentence */
export function statusProblem(b: { status?: any; resolution?: any; duplicate_of?: any }): string | null {
  const s = String(b?.status ?? '') as FeedbackStatus;
  if (!STAFF_STATUSES.includes(s)) return 'Choose a status.';
  if (NEEDS_TEXT.includes(s) && !cleanMessage(b?.resolution)) return s === 'ANSWERED' ? 'Write the answer the reporter will read.' : 'Say why it is not planned.';
  if (s === 'DUPLICATE' && !(Number(b?.duplicate_of) > 0)) return 'Give the number of the report this repeats.';
  return null;
}

/** the two flags the alerts read after a change: who owes the next word, and whether the reporter has something unread */
export function flagsAfter(by: 'reporter' | 'staff'): { awaiting_staff: boolean; reporter_unread: boolean } {
  return by === 'reporter' ? { awaiting_staff: true, reporter_unread: false } : { awaiting_staff: false, reporter_unread: true };
}
