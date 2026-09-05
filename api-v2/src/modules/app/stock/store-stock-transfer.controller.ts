import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { PermissionGuard } from "src/core/guards/permission.guard";
import { Permission } from "src/core/decorator/permission.decorator";
import { User } from "src/core/decorator/user.decorator";
import { StoreStockTransferService } from "./store-stock-transfer.service";
import { CreateStoreStockTransferDto } from "./dto/create-store-stock-transfer.dto";
import { ReceiveStoreStockTransferDto } from "./dto/receive-store-stock-transfer.dto";

@ApiTags('Store stock transfers')
@Controller('store-stock-transfers')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class StoreStockTransferController {

    constructor(private readonly service: StoreStockTransferService) {}

    @Get()
    @UseGuards(PermissionGuard)
    @Permission('auditStock')
    findAll(@Query() query: { storeid?: string; status?: string }) {
        return this.service.findAll(query);
    }

    @Get('available')
    @UseGuards(PermissionGuard)
    @Permission('auditStock')
    available(@Query('itemid') itemid: string, @Query('storeid') storeid: string) {
        return this.service.availableAtStore(Number(itemid), Number(storeid));
    }

    @Post()
    @UseGuards(PermissionGuard)
    @Permission('auditStock')
    dispatch(@Body() dto: CreateStoreStockTransferDto, @User() currentUser: any) {
        return this.service.dispatch(dto, currentUser.id);
    }

    @Put(':id/receive')
    @UseGuards(PermissionGuard)
    @Permission('auditStock')
    receive(@Param('id') id: string, @Body() dto: ReceiveStoreStockTransferDto, @User() currentUser: any) {
        return this.service.receive(Number(id), dto, currentUser.id);
    }

    @Put(':id/cancel')
    @UseGuards(PermissionGuard)
    @Permission('auditStock')
    cancel(@Param('id') id: string, @User() currentUser: any) {
        return this.service.cancel(Number(id), currentUser.id);
    }
}
