import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { User } from "src/core/decorator/user.decorator";
import { VendorPaymentService } from "./vendor-payment.service";
import { CreateVendorPaymentDto } from "./dto/create-vendor-payment.dto";
import { UpdateVendorPaymentDto } from "./dto/update-vendor-payment.dto";

@ApiTags('VendorPayments')
@Controller('vendorpayments')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class VendorPaymentController {
    constructor(private service: VendorPaymentService) {}

    @Get('invoice/:invoiceid')
    findByInvoice(@Param('invoiceid') invoiceid: string) {
        return this.service.findByInvoice(+invoiceid);
    }

    @Post()
    create(@Body() dto: CreateVendorPaymentDto, @User() currentUser: any) {
        return this.service.create(dto, currentUser.id);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() dto: UpdateVendorPaymentDto, @User() currentUser: any) {
        return this.service.update(+id, dto, currentUser.id);
    }
}
