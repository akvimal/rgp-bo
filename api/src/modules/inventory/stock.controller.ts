import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { StockService } from "./stock.service";


@ApiTags('Stock')
@Controller('stock')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class StockController {
    
    constructor(private service:StockService){}

    @Get()
    async findAll() {
      return this.service.findAll();
    }

    // @Get()
    // async findByCriteria() {
    //   return this.service.findByCriteria({});
    // }
}