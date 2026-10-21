import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { PurchasingAlsoAllow, PurchasingGuard } from "../roles/purchasing.guard";
import { PermissionService } from "../roles/permission.service";
import { PurchaseService } from './purchase.service';
import { CreatePurchaseRequestDto } from './dto/create-request.dto';
import { User } from 'src/core/decorator/user.decorator';
import { UpdatePurchaseRequestDto } from './dto/update-request.dto';

@ApiTags('PurchaseRequests')
@Controller('purchaserequests')
@ApiBearerAuth()
@UseGuards(AuthGuard, PurchasingGuard)
export class PurchaseRequestController {

    constructor(private service:PurchaseService, private permissions: PermissionService){}

    /** a role that may only raise requests (no purchases.add) sees and creates only its own, without the buying side's fields */
    private async ownerOf(user: any): Promise<number | undefined> {
        return (await this.permissions.can(user?.roleid, 'purchases', 'add')) ? undefined : user.id;
    }

    @Get('/:id')
    async findById(@Param('id') id: number, @User() currentUser: any) {
      return this.service.findRequestById(id, await this.ownerOf(currentUser));
    }

    @Get()
    async findAll(@Query() query: any, @User() currentUser: any) {
        return this.service.findAllRequests(query, await this.ownerOf(currentUser));
    }

    @Post('/filter')
    async filter(@Body() criteria: any, @User() currentUser: any) {
      return this.service.findAllRequestsByCriteria(criteria, await this.ownerOf(currentUser));
    }

    @Post()
    @PurchasingAlsoAllow('request')
    async create(@Body() createDto: CreatePurchaseRequestDto,  @User() currentUser: any) {
        return this.service.createRequest(createDto, currentUser.id, !!(await this.ownerOf(currentUser)));
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() updateDto:UpdatePurchaseRequestDto, @User() currentUser: any) {
      return this.service.updateRequest(id, updateDto, currentUser.id);
    }
    
    @Put(':id/remove')
    removeOrder(@Param('id') id: string, @User() currentUser: any) {
      return this.service.removeOrder(id, currentUser.id);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @User() currentUser: any) {
      return this.service.updateRequest(id, {isActive:false}, currentUser.id);
    }
}