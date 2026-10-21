import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

/**
 * New purchasing business (a request, an order, a received invoice) is refused for a vendor that is blocked or
 * disabled. Paying existing dues is not covered here: a blocked or disabled vendor can still be paid.
 * A missing vendor is left to the caller's own "not found" handling.
 */
export async function assertVendorUsable(manager: EntityManager, vendorId: number | string | null | undefined, action: string): Promise<void> {
  if (vendorId === null || vendorId === undefined || vendorId === '') return;
  const [v] = await manager.query(`select business_name, active, blocked, block_reason from vendor where id = $1`, [+vendorId]);
  if (!v) return;
  const name = String(v.business_name).trim();
  if (!v.active) throw new BadRequestException(`${name} is disabled, so ${action} is not allowed. Enable the vendor first.`);
  if (v.blocked) throw new BadRequestException(`${name} is blocked (${v.block_reason}), so ${action} is not allowed until it is unblocked.`);
}
