import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { BusinessService } from "./business.service";

@ApiTags('Business')
@Controller('businesses')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class BusinessController {
    
    constructor(private service:BusinessService){}

}