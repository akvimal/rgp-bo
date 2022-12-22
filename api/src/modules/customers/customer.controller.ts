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

    @Get(':id')
    async findOne(@Param('id') id: string) {
      return this.customerService.findById(id);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
      return this.customerService.update(id, {isActive:false});
    }
}