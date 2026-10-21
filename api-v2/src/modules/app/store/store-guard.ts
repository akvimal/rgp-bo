import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

/**
 * Drugs are not taken into a store whose drug licence (retail or wholesale) has expired. A store with no licence
 * recorded is left alone: nothing is known, so nothing is blocked.
 */
export async function assertStoreLicensed(manager: EntityManager, storeId: number | string | null | undefined, action: string): Promise<void> {
  if (storeId === null || storeId === undefined || storeId === '') return;
  const [r] = await manager.query(`select public.store_drug_license_expired($1) as expired, (select location from stores where id = $1) as location`, [+storeId]);
  if (r?.expired) throw new BadRequestException(`${String(r.location).trim()} has no valid drug licence (it has expired), so ${action} is not allowed. Renew it under Settings > Store.`);
}
