import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { redactCostFields } from './cost-redaction';

import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Stock2Service } from "./stock2.service";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { User } from "src/core/decorator/user.decorator";
import { PermissionService } from "../roles/permission.service";

@ApiTags('Stock2')
@Controller('stock2')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class Stock2Controller {
    
    constructor(private service:Stock2Service, private permissions: PermissionService){}

    private async assertCanViewCost(currentUser: any) {
      if (!(await this.permissions.canViewCost(currentUser.roleid))) {
        throw new ForbiddenException('Cost access denied');
      }
    }

    private redactCostFields(data: any) { return redactCostFields(data); }

    @Post()
    async findAll(@Body() body, @User() currentUser: any) {
      await this.assertCanViewCost(currentUser);
      return this.service.findAll({...body.criteria});
    }

    @Get('/expiries/all')
    async getMonthAvailableList() {
      return this.service.getMonthAvailableList();
    }
    @Get('/expiries/near-count')
    async getNearExpiryCount() {
      return this.service.getNearExpiryCount();
    }
    @Get('/expiries/month/:month')
    async getProductsByExpiryMonths(@Param('month') month: string) {
      return this.service.findProductsByExpiries(month);
    }

    @Get('/:id')
    async findProductItems(@Param('id') id: number, @User() currentUser: any) {
      await this.assertCanViewCost(currentUser);
      return this.redactCostFields(await this.service.findProductItemsById(id));
    }

}
