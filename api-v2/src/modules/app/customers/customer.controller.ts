import { CustomerService } from "./customer.service";
import { CustomerCreditService } from "./customer-credit.service";
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { User } from "src/core/decorator/user.decorator";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { AuthGuard } from "src/modules/auth/auth.guard";

@ApiTags('Customers')
@Controller('customers')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class CustomerController {

    constructor(private customerService:CustomerService, private creditService:CustomerCreditService){}

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

    @Get('by-mobile/:mobile')
    async byMobile(@Param('mobile') mobile: string) {
      return this.customerService.byMobile(mobile);
    }

    @Get('duplicates')
    async duplicates(@User() currentUser: any) {
      return this.customerService.duplicates(currentUser);
    }

    @Post('merge')
    async merge(@Body() body: any, @User() currentUser: any) {
      return this.customerService.merge(body, currentUser);
    }

    @Get('search/mobile/:mobile')
    async findOneByMobile(@Param('mobile') mobile: string) {
      return this.customerService.findByMobile(mobile);
    }

    @Get(':id')
    async findOne(@Param('id') id: number) {
      return this.customerService.findById(id);
    }

    @Get(':id/credit')
    async credit(@Param('id', ParseIntPipe) id: number) {
      return this.creditService.get(id);
    }

    @Post(':id/credit/adjustment')
    async adjustCredit(@Param('id', ParseIntPipe) id: number, @Body() body: any, @User() currentUser: any) {
      return this.creditService.adjust(id, body, currentUser);
    }

    @Get(':id/stats')
    async getCustomerStats(@Param('id') id: number) {
      return this.customerService.getCustomerStats(id);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @User() currentUser: any) {
      return this.customerService.remove(Number(id), currentUser);
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