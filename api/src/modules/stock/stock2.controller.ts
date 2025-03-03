import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Stock2Service } from "./stock2.service";

@ApiTags('Stock2')
@Controller('stock2')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class Stock2Controller {
    
    constructor(private service:Stock2Service){}

    @Post()
    async findAll(@Body() body) {
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
    async findProductItems(@Param('id') id: number) {
      return this.service.findProductItemsById(id);
    }

}