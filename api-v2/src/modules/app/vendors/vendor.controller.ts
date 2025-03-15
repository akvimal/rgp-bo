import { VendorService } from "./vendor.service";
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { CreateVendorDto } from "./dto/create-vendor.dto";

import { UpdateVendorDto } from "./dto/update-vendor.dto";
import { User } from "src/core/decorator/user.decorator";
import { AuthGuard } from "src/modules/auth/auth.guard";

@ApiTags('Vendors')
@Controller('vendors')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class VendorController {

    constructor(private vendorService:VendorService){}

    @Post()
    async create(@Body() createVendorDto: CreateVendorDto) {
        return this.vendorService.create(createVendorDto);
    }
    
    @Put(':id')
    update(@Param('id') id: string, @Body() updateDto: UpdateVendorDto, @User() currentUser: any) {
      return this.vendorService.update(id, updateDto, currentUser.id);
    }

    @Get()
    async findAll() {
      return this.vendorService.findAll();
    }

    @Get(':id')
    async findOne(@Param('id') id: number) {
      return this.vendorService.findById(id);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @User() currentUser: any) {
      return this.vendorService.update(id, {isActive:false}, currentUser.id);
    }
}