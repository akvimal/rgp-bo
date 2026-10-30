/**
 * A person's pay structure and how it has changed, for the person themselves. Pure: the service passes in the revisions.
 * Each revision is a full statement of the pay from its date, so a change is the difference from the revision before it.
 */
export interface PayLine { component_id: number; name: string; kind: string; amount: number }
export interface PayRevision { id: number; effective_from: string; lines: PayLine[] }

export interface PayChange { name: string; kind: string; from: number | null; to: number | null }
export interface PayStep { id: number; effective_from: string; upcoming: boolean; lines: PayLine[]; gross: number; deductions: number; changes: PayChange[] }

const r2 = (n: number) => Math.round(n * 100) / 100;
const sum = (lines: PayLine[], kind: string) => r2(lines.filter((l) => l.kind === kind).reduce((t, l) => t + Number(l.amount), 0));

/** newest first; `today` is a YYYY-MM-DD date. A revision dated after today is upcoming, not yet in force. */
export function payHistory(revisions: PayRevision[], today: string): { current: PayStep | null; upcoming: PayStep[]; history: PayStep[] } {
  const asc = [...revisions].sort((a, b) => a.effective_from.localeCompare(b.effective_from));
  const steps: PayStep[] = asc.map((rev, i) => {
    const lines = (rev.lines || []).map((l) => ({ ...l, amount: Number(l.amount) }));
    const before = i > 0 ? (asc[i - 1].lines || []) : [];
    const names = new Map<number, string>();
    const changes: PayChange[] = [];
    for (const l of lines) names.set(l.component_id, l.name);
    for (const l of before) if (!names.has(l.component_id)) names.set(l.component_id, l.name);
    for (const [cid, name] of names) {
      const now = lines.find((l) => l.component_id === cid);
      const was = before.find((l) => l.component_id === cid);
      const to = now ? Number(now.amount) : null;
      const from = was ? Number(was.amount) : null;
      if (i > 0 && from !== to) changes.push({ name, kind: (now || was)!.kind, from, to });
    }
    return { id: rev.id, effective_from: rev.effective_from, upcoming: rev.effective_from > today, lines, gross: sum(lines, 'EARNING'), deductions: sum(lines, 'DEDUCTION'), changes };
  });
  const inForce = steps.filter((s) => !s.upcoming);
  const current = inForce.length ? inForce[inForce.length - 1] : null;
  return { current, upcoming: steps.filter((s) => s.upcoming), history: inForce.slice().reverse() };
}
