import { Module, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthModule } from 'src/modules/auth/auth.module';
import { SaleHooks } from 'src/core/sale-hooks/sale-hooks';
import { RoleModule } from 'src/modules/app/roles/role.module';
import { DrugRegisterController } from './drug-register.controller';
import { DrugRegisterService } from './drug-register.service';
import { chronicMobileHook, drugRegisterHook } from './pharmacy-hooks';
import { licenceBlockHook } from './licence-block';
import { ConfigService } from 'src/core/config/config.service';

/**
 * The PHARMACY PACK: what a pharmacy needs and other businesses do not. It joins core through the sale hooks, the module switches (drug_register) and
 * its own routes; core does not import it. Left out of PACKS in the environment, none of it is loaded.
 *
 * Today the pack holds: the drug register (Schedule H, H1, X) and the chronic-medicine mobile rule. See docs/planning/BUSINESS_TYPES_AND_PACKS.md for what is still
 * in core and should move here.
 */
@Module({
  imports: [AuthModule, RoleModule],
  controllers: [DrugRegisterController],
  providers: [DrugRegisterService, JwtService],
  exports: [DrugRegisterService],
})
export class PharmacyPackModule implements OnModuleInit {
  constructor(private readonly hooks: SaleHooks, private readonly register: DrugRegisterService, private readonly config: ConfigService) {}

  onModuleInit() {
    this.hooks.register(chronicMobileHook);
    this.hooks.register(drugRegisterHook(this.register));
    this.hooks.register(licenceBlockHook(this.config));
  }
}
