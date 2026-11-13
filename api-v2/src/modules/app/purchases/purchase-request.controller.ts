import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { PurchasingAlsoAllow, PurchasingGuard } from "../roles/purchasing.guard";
import { PermissionService } from "../roles/permission.service";
import { PurchaseService, RequestScope } from './purchase.service';
import { AddSlipLinesDto, CreatePurchaseRequestSlipDto } from './dto/create-request-slip.dto';
import { CreatePurchaseRequestDto } from './dto/create-request.dto';
import { User } from 'src/core/decorator/user.decorator';
import { UpdatePurchaseRequestDto } from './dto/update-request.dto';

@ApiTags('PurchaseRequests')
@Controller('purchaserequests')
@ApiBearerAuth()
@UseGuards(AuthGuard, PurchasingGuard)
export class PurchaseRequestController {

    constructor(private service:PurchaseService, private permissions: PermissionService){}

    /** a role that may only raise requests (no purchases.add) sees its own requests and every request of its store(s), without the buying side's fields */
    private async scopeOf(user: any): Promise<RequestScope | undefined> {
        if (await this.permissions.can(user?.roleid, 'purchases', 'add')) return undefined;
        return { userId: user.id, storeIds: await this.service.storesOfUser(user.id) };
    }

    @Get('/:id')
    async findById(@Param('id') id: number, @User() currentUser: any) {
      return this.service.findRequestById(id, await this.scopeOf(currentUser));
    }

    @Get()
    async findAll(@Query() query: any, @User() currentUser: any) {
        return this.service.findAllRequests(query, await this.scopeOf(currentUser));
    }

    @Post('/filter')
    async filter(@Body() criteria: any, @User() currentUser: any) {
      return this.service.findAllRequestsByCriteria(criteria, await this.scopeOf(currentUser));
    }

    @Post()
    @PurchasingAlsoAllow('request')
    async create(@Body() createDto: CreatePurchaseRequestDto,  @User() currentUser: any) {
        return this.service.createRequest(createDto, currentUser.id, !!(await this.scopeOf(currentUser)));
    }

    /** several products asked for together (shared fields copied onto each line's request) */
    @Post('slip')
    @PurchasingAlsoAllow('request')
    async createSlip(@Body() dto: CreatePurchaseRequestSlipDto, @User() currentUser: any) {
        return this.service.createSlip(dto, currentUser.id, !!(await this.scopeOf(currentUser)));
    }

    @Post('slip/:groupid/lines')
    @PurchasingAlsoAllow('request')
    async addToSlip(@Param('groupid') groupid: string, @Body() dto: AddSlipLinesDto, @User() currentUser: any) {
        const scope = await this.scopeOf(currentUser);
        return this.service.addToSlip(+groupid, dto, currentUser.id, !!scope, scope);
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