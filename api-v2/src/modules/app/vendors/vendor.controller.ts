import { VendorService } from "./vendor.service";
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { BlockVendorDto } from "./dto/block-vendor.dto";
import { CreateVendorDto } from "./dto/create-vendor.dto";

import { UpdateVendorDto } from "./dto/update-vendor.dto";
import { User } from "src/core/decorator/user.decorator";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { PurchasingGuard, PurchasingWriteAction } from "../roles/purchasing.guard";

@ApiTags('Vendors')
@Controller('vendors')
@ApiBearerAuth()
@UseGuards(AuthGuard, PurchasingGuard)
@PurchasingWriteAction('vendors.edit')
// No global ValidationPipe in this app; vendor input is checked here (GSTIN, PAN, IFSC, mobile, ...).
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class VendorController {

    constructor(private vendorService:VendorService){}

    @Post()
    async create(@Body() createVendorDto: CreateVendorDto, @User() currentUser: any) {
        return this.vendorService.create(createVendorDto, currentUser.id);
    }

    @Put(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateVendorDto, @User() currentUser: any) {
      return this.vendorService.update(id, updateDto, currentUser.id);
    }

    @Get()
    async findAll(@Query('status') status: string) {
      return this.vendorService.findAll(['usable', 'blocked', 'disabled', 'all'].includes(status) ? status : 'active');
    }

    // must stay above ':id'
    @Get('licenses/expiring')
    async expiringLicenses(@Query('days') days: string) {
      return this.vendorService.expiringLicenses(days ? +days : undefined);
    }

    @Get(':id')
    async findOne(@Param('id', ParseIntPipe) id: number) {
      return this.vendorService.findById(id);
    }

    /** Put on hold: no new requests, orders or invoices; dues can still be paid. */
    @Post(':id/block')
    block(@Param('id', ParseIntPipe) id: number, @Body() dto: BlockVendorDto, @User() currentUser: any) {
      return this.vendorService.block(id, dto.reason, currentUser.id);
    }

    @Post(':id/unblock')
    unblock(@Param('id', ParseIntPipe) id: number, @User() currentUser: any) {
      return this.vendorService.unblock(id, currentUser.id);
    }

    /** Bring a disabled vendor back. */
    @Post(':id/enable')
    enable(@Param('id', ParseIntPipe) id: number, @User() currentUser: any) {
      return this.vendorService.enable(id, currentUser.id);
    }

    /** Disables (retires) the vendor; history and dues are kept. */
    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number, @User() currentUser: any) {
      return this.vendorService.update(id, {isActive:false}, currentUser.id);
    }
}
