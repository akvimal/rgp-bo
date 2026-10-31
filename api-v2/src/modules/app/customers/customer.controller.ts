import { CustomerService } from "./customer.service";
import { CustomerCreditService } from "./customer-credit.service";
import { CustomerPrivacyService } from "./customer-privacy.service";
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Post, Query, UseGuards } from "@nestjs/common";
import { User } from "src/core/decorator/user.decorator";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { AuthGuard } from "src/modules/auth/auth.guard";

@ApiTags('Customers')
@Controller('customers')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class CustomerController {

    constructor(private customerService:CustomerService, private creditService:CustomerCreditService, private privacy:CustomerPrivacyService){}

    @Post()
    async create(@Body() createCustomerDto: CreateCustomerDto, @User() currentUser: any) {
        const saved = await this.customerService.save(createCustomerDto, currentUser?.id);
        // what the caller typed comes back as typed (billing uses it); anything they did not supply stays masked for a login that may not read it all
        return this.privacy.protectUnsupplied(saved as any, createCustomerDto as any, currentUser);
    }

    @Get()
    async findAll(@User() currentUser: any) {
      return this.customerService.findAll(currentUser);
    }

    /** what this login may see of customers' contact details, and how many reveals are left today */
    @Get('privacy')
    async privacyStatus(@User() currentUser: any) {
      return this.privacy.status(currentUser);
    }

    /** ids of customers matching a name, place or number: the search for screens that only hold masked numbers */
    @Get('lookup')
    async lookup(@Query('q') q: string, @User() currentUser: any) {
      return this.customerService.lookup(q, currentUser);
    }

    /** a customer screen reports that someone tried to print it */
    @Post('events')
    async event(@Body() body: any, @User() currentUser: any) {
      return this.privacy.logEvent(currentUser, String(body?.kind || ''), String(body?.page || ''), body?.blocked !== false);
    }

    /** who revealed how many customers lately (managers only) */
    @Get('reveals')
    async reveals(@User() currentUser: any, @Query('days') days?: string) {
      if (!(await this.privacy.canRevealAll(currentUser))) throw new ForbiddenException('Only a manager can see who revealed customer details.');
      return this.privacy.revealReport(Number(days) || 7);
    }

    @Post(':id/reveal')
    async reveal(@Param('id', ParseIntPipe) id: number, @User() currentUser: any) {
      return this.privacy.reveal(id, currentUser);
    }

    // @Post('/sale')
    // async findSaleData(@Body() criteria: any) {
    //   return this.customerService.findSaleData(criteria);
    // }

    @Post('/filter')
    async filterByCriteria(@Body() criteria: any, @User() currentUser: any) {
      return this.customerService.filterByCriteria(criteria, currentUser);
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
    async findOne(@Param('id') id: number, @User() currentUser: any) {
      return this.customerService.findById(id, currentUser);
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