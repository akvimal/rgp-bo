import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Query, UseGuards } from "@nestjs/common";

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

    private redactCostFields(data: any) {
      if (!data) {
        return data;
      }
      const strip = (value: any): any => {
        if (Array.isArray(value)) {
          return value.map(strip);
        }
        if (value && typeof value === 'object') {
          const clone: any = {};
          Object.entries(value).forEach(([key, entry]) => {
            if (['mrp_cost', 'ptr_cost', 'ptr_value', 'oldprice', 'cost'].includes(key)) {
              return;
            }
            clone[key] = strip(entry);
          });
          return clone;
        }
        return value;
      };
      return strip(data);
    }

    @Post()
    async findAll(@Body() body, @User() currentUser: any) {
      await this.assertCanViewCost(currentUser);
      return this.service.findAll({...body.criteria});
    }

    @Get('/expiries/all')
    async getMonthAvailableList() {
      return this.service.getMonthAvailableList();
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
