import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "src/modules/auth/auth.guard";
import { PurchaseService } from './purchase.service';
import { User } from 'src/core/decorator/user.decorator';
import { CreateSuggestionOrderDto } from './dto/create-suggestion-order.dto';

@ApiTags('PurchaseSuggestions')
@Controller('purchase-suggestions')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class PurchaseSuggestionController {
    constructor(private service: PurchaseService) {}

    @Get()
    async findAll(@Query() query: any) {
        return this.service.findSuggestions(query);
    }

    @Post('/create-orders')
    async createOrders(@Body() dto: CreateSuggestionOrderDto, @User() currentUser: any) {
        return this.service.createOrdersFromSuggestions(dto, currentUser.id);
    }
}
