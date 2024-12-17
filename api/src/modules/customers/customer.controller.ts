import { CustomerService } from "./customer.service";
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { AuthGuard } from "@nestjs/passport";

@ApiTags('Customers')
@Controller('customers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class CustomerController {

    constructor(private customerService:CustomerService){}

    @Post()
    async create(@Body() createCustomerDto: CreateCustomerDto) {
        return this.customerService.save(createCustomerDto);
    }

    @Get()
    async findAll() {
      return this.customerService.findAll();
    }

    // @Post('/sale')
    // async findSaleData(@Body() criteria: any) {
    //   return this.customerService.findSaleData(criteria);
    // }

    @Post('/filter')
    async filterByCriteria(@Body() criteria: any) {
      return this.customerService.filterByCriteria(criteria);
    }

    @Get(':mobile/mobile')
    async findOneByMobile(@Param('mobile') mobile: string) {
      return this.customerService.findByMobile(mobile);
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
      return this.customerService.findById(id);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
      return this.customerService.update(id, {isActive:false});
    }

    @Get('/:id/periods')
    async findCustomerOrderesMonths(@Param('id') custid: string) {
      return await this.customerService.findSalePeriods(custid);
    }

    @Get('/:id/:year/:month/orders')
    async findCustomerOrdersByPeriod(@Param('id') custid: string,
        @Param('year') year: number,
        @Param('month') month: number) {
      return await this.customerService.findCustomerSaleByPeriod(custid,year,month);
    }   
    
    @Get('/:id/documents')
    async findDocuments(@Param('id') custid: string) {
      return await this.customerService.findDocuments(custid);
    }

    @Post('/documents/add')
    async addDocument(@Body() body) {
        return this.customerService.addDocument(body);
    }

    @Post('/documents/remove')
    async removeDocument(@Body() body) {
        return this.customerService.removeDocument(body.customerId,body.ids);
    }
}