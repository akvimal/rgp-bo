import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { User } from "src/core/decorator/user.decorator";
import { CustomerService } from "../customers/customer.service";
import { SaleDeliveryService } from "./sale-delivery.service";
import { CreateSaleDeliveryDto } from "./dto/create-saledelivery.dto";
import { UpdateSaleDeliveryDto } from "./dto/update-saledelivery.dto";

@ApiTags('Deliveries')
@Controller('deliveries')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class SaleDeliveryController {

    constructor(private service:SaleDeliveryService, 
      private custService:CustomerService){}

      @Post()
      async create(@Body() dto: CreateSaleDeliveryDto, @User() currentUser: any) {
        return this.service.save(dto, currentUser.id);
      }

    @Get()
    async findAll(@Query() query: any, @User() currentUser: any) {
      return this.service.findAll(query,query['self']==='true'?currentUser.id:null);
    }

    /** recent counter bills that could be made a delivery: ?days=3&q=<bill no, name or mobile>&storeid= */
    @Get('candidates')
    async candidates(@Query() query: any, @User() currentUser: any) {
      return this.service.candidates(query, currentUser);
    }

    /** a completed bill becomes a delivery (or a counter sale again): { type: 'Delivery' | 'Counter', reason?, delivery?: {...} } */
    @Post('mode/:saleid')
    async changeMode(@Param('saleid') saleid: string, @Body() body: any, @User() currentUser: any) {
      return this.service.changeMode(+saleid, body, currentUser);
    }

    /** the entries already recorded that could be this delivery's cost, to link instead of paying again */
    @Get(':saleid/cost-candidates')
    async costCandidates(@Param('saleid') saleid: string, @User() currentUser: any) {
      return this.service.costCandidates(+saleid, currentUser);
    }

    /** which drawer a cash payment would come from, and the other open shifts a Store Head or above may choose */
    @Get(':saleid/cash-shifts')
    async cashShifts(@Param('saleid') saleid: string, @User() currentUser: any) {
      return this.service.cashShifts(+saleid, currentUser);
    }

    /** deliveries whose cost is not linked to an expense, and the pairs that can be linked in one go: ?days=120 */
    @Get('cost-links/suggestions')
    async costSuggestions(@Query() query: any, @User() currentUser: any) {
      return this.service.costSuggestions(query, currentUser);
    }

    /** links expenses already recorded to deliveries: { links: [{ saleid, kind: CASH | DIGITAL, entryid }] } */
    @Post('cost-links')
    async linkCosts(@Body() body: any, @User() currentUser: any) {
      return this.service.linkCosts(body, currentUser);
    }

    @Put(':saleid')
    async update(@Param('saleid') saleid: string, @Body() dto: UpdateSaleDeliveryDto, @User() currentUser: any) {
      return this.service.update({ ...dto, saleid: +saleid }, currentUser);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
      return this.service.delete(id);
    }
    
}
