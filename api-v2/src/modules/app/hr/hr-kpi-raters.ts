import { EntityManager } from 'typeorm';
import { isOwnerRole } from 'src/core/roles';

/**
 * Who may rate a manual KPI measure.
 *   - The Business Head (owner) may rate any measure.
 *   - A measure with a "rated by" list of job roles may be rated only by people whose job role (on their HR staff record) is in the list.
 *   - A measure with no list is rated, as before, by anyone whose login role holds the KPI rating permission (Store Head, Business Head).
 * Pure, so it can be tested.
 */
export interface RaterProfile { owner: boolean; roleCan: boolean; positionId: number | null }

export function mayRate(p: RaterProfile, raterPositions: number[] | null | undefined): boolean {
  if (p.owner) return true;
  if (raterPositions && raterPositions.length) return p.positionId !== null && raterPositions.includes(p.positionId);
  return p.roleCan;
}

/** the person's login role (does it hold the KPI rating permission?) and their job role on the HR staff record */
export async function raterProfile(manager: EntityManager, userId: number): Promise<RaterProfile & { role: string | null }> {
  const [r] = await manager.query(
    `select ro.name as role,
            exists (select 1 from jsonb_array_elements(coalesce(ro.permissions::jsonb, '[]'::jsonb)) e, jsonb_array_elements(coalesce(e->'policies', '[]'::jsonb)) p
                     where e->>'resource' = 'kpirate' and p->>'action' = 'rate') as role_can,
            (select e.position_id from hr_employee e where e.user_id = u.id and e.exit_date is null order by e.id desc limit 1) as position_id
       from app_user u join app_role ro on ro.id = u.role_id where u.id = $1`, [userId || 0]);
  return { role: r?.role ?? null, owner: isOwnerRole(r?.role), roleCan: !!r?.role_can, positionId: r?.position_id ?? null };
}

/**
 * Whether the person's job role is named as a rater on some active manual measure, so the rating screen must open for them even though their login
 * role does not hold the KPI rating permission.
 */
export async function isListedRater(manager: EntityManager, userId: number): Promise<boolean> {
  const [r] = await manager.query(
    `select exists (
       select 1 from hr_kpi_metric m join hr_employee e on e.user_id = $1 and e.exit_date is null
        where m.active and m.source = 'MANUAL' and e.position_id is not null and e.position_id = any(coalesce(m.rater_positions, '{}'::int[]))) as listed`, [userId || 0]);
  return !!r?.listed;
}
