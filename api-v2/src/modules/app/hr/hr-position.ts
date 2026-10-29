/**
 * A job role's pay structure: the standard amount of each pay component. Pure, so it is tested without a database.
 * It is a template only. A salary revision starts from it and the owner can change any amount before saving.
 */
export interface PositionLine { component_id: number; amount: number }

/** the lines sent by the screen, cleaned: whole components once each, amounts to the paisa, nothing zero or negative */
export function normaliseLines(raw: any): PositionLine[] {
  const seen = new Map<number, number>();
  for (const l of Array.isArray(raw) ? raw : []) {
    const id = Number(l?.component_id);
    const amount = Math.round(Number(l?.amount) * 100) / 100;
    if (Number.isInteger(id) && id > 0 && Number.isFinite(amount) && amount > 0) seen.set(id, amount);
  }
  return Array.from(seen, ([component_id, amount]) => ({ component_id, amount }));
}

/** a structure needs at least one earning, as a salary does */
export function hasEarning(lines: PositionLine[], kindOf: Record<number, string>): boolean {
  return lines.some((l) => kindOf[l.component_id] === 'EARNING');
}
