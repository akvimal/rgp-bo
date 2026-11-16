import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { PermissionGuard } from "src/core/guards/permission.guard";
import { Permission } from "src/core/decorator/permission.decorator";
import { User } from "src/core/decorator/user.decorator";
import { DeliveryPartnerService } from "./delivery-partner.service";
import { CreateDeliveryPartnerDto } from "./dto/create-delivery-partner.dto";
import { UpdateDeliveryPartnerDto } from "./dto/update-delivery-partner.dto";

@ApiTags('Delivery Partners')
@Controller('delivery-partners')
@ApiBearerAuth()
/** Anyone signed in may read the partners (the delivery screens at the till offer them); changing them needs an owner role or the deliverypartners manage permission. */
@UseGuards(AuthGuard, PermissionGuard)
export class DeliveryPartnerController {
    constructor(private service: DeliveryPartnerService) {}

    @Permission('manageDeliveryPartners')
    @Post()
    create(@Body() dto: CreateDeliveryPartnerDto, @User() currentUser: any) {
        return this.service.create(dto, currentUser.id);
    }

    @Get()
    findAll() {
        return this.service.findAll();
    }

    @Get(':id')
    findById(@Param('id') id: string) {
        return this.service.findById(+id);
    }

    @Permission('manageDeliveryPartners')
    @Put(':id')
    update(@Param('id') id: string, @Body() dto: UpdateDeliveryPartnerDto, @User() currentUser: any) {
        return this.service.update(+id, dto, currentUser.id);
    }

    @Permission('manageDeliveryPartners')
    @Delete(':id')
    remove(@Param('id') id: string, @User() currentUser: any) {
        return this.service.remove(+id, currentUser.id);
    }
}
