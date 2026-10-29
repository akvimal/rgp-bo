/**
 * How a job role ties pay, KPI and incentive together. Pure: no framework, no database, so it is tested without either.
 * The job role is what a person does; the login role is what they may do on screen. HR rules follow the job role first and fall back to the
 * login role and the default, so nothing set up before job roles existed stops working.
 */
export interface BandRow { role_name?: string | null; position_id?: number | null; min: number; pct: number; label: string }

/** the band set that applies: the person's job role's own, else their login role's own, else the default set (the rows with neither) */
export function pickBands<T extends { role_name?: string | null; position_id?: number | null }>(all: T[], positionId: number | null | undefined, roleName: string | null | undefined): T[] {
  const byPosition = positionId ? all.filter((b) => b.position_id === positionId) : [];
  if (byPosition.length) return byPosition;
  const byRole = roleName ? all.filter((b) => !b.position_id && b.role_name === roleName) : [];
  if (byRole.length) return byRole;
  return all.filter((b) => !b.position_id && !b.role_name);
}

/** a measure limited to job roles applies to the people who hold one of them; with no limit it applies to every job role (and to people with none) */
export function appliesToPosition(measurePositions: number[] | null | undefined, positionId: number | null | undefined): boolean {
  if (!measurePositions?.length) return true;
  return !!positionId && measurePositions.includes(positionId);
}

/** the band for a score: the highest band the score reaches */
export function bandFor<T extends { min: number }>(set: T[], percent: number): T | undefined {
  return [...set].sort((a, b) => b.min - a.min).find((b) => b.min <= percent);
}

export interface DesignationGroup { designation: string; staff: number; position_id: number | null }

/**
 * The distinct designations typed on staff records (trimmed, one group per spelling in any case), most used first, each with the job role of the same
 * name when there is one. Offered so the owner can turn what was typed into job roles; it changes nothing by itself.
 */
export function groupDesignations(people: { designation: string | null; position_id: number | null }[], positions: { id: number; name: string }[]): DesignationGroup[] {
  const groups = new Map<string, DesignationGroup & { spellings: Map<string, number> }>();
  for (const p of people) {
    const d = String(p.designation || '').trim();
    if (!d || p.position_id) continue;
    const key = d.toLowerCase();
    const g = groups.get(key) || { designation: d, staff: 0, position_id: positions.find((x) => x.name.trim().toLowerCase() === key)?.id ?? null, spellings: new Map<string, number>() };
    g.staff += 1;
    g.spellings.set(d, (g.spellings.get(d) || 0) + 1);
    groups.set(key, g);
  }
  return Array.from(groups.values())
    .map((g) => ({ designation: Array.from(g.spellings.entries()).sort((a, b) => b[1] - a[1])[0][0], staff: g.staff, position_id: g.position_id }))
    .sort((a, b) => b.staff - a.staff || a.designation.localeCompare(b.designation));
}
