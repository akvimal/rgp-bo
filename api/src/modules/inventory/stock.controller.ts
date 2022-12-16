import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { StockService } from "./stock.service";


@ApiTags('Stock')
@Controller('stock')
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