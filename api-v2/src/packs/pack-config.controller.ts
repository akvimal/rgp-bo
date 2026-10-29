import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EntityManager } from 'typeorm';
import { AuthGuard } from 'src/modules/auth/auth.guard';
import { User } from 'src/core/decorator/user.decorator';
import { businessOfUser } from 'src/core/business-of-user';
import { packsOf } from 'src/core/modules/modules';
import { packEnabled } from './packs';
import { buildConfig } from './pack-config';

/**
 * What the app reads to know what kind of business it is serving: the business type, the packs it has, and the configuration they bring (words,
 * product attributes, document types, licence types). A pack that this installation does not load adds nothing.
 */
@ApiTags('Packs')
@Controller('packs')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class PackConfigController {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  @Get('config')
  async config(@User() user: any) {
    const businessId = await businessOfUser(this.manager, user.id);
    const [b] = businessId ? await this.manager.query(`select business_type from business where id = $1`, [businessId]) : [null];
    const businessType = b?.business_type ?? 'pharmacy';
    const packs = packsOf(businessType).filter((p) => packEnabled(p));
    return { businessType, packs, ...buildConfig(packs) };
  }
}
