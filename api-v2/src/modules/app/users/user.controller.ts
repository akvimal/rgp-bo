import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, Req } from "@nestjs/common";
import { Request } from 'express';

import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { User } from "../../../core/decorator/user.decorator";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserService } from "./user.service";
import { AuthGuard } from "src/modules/auth/auth.guard";

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class UserController {

    constructor(private userService:UserService){}

    @Get()
    async findAll() {
      return this.userService.findAll();
    }

    @Get(':id')
    async findOne(@Param('id') id: number) {
      return this.userService.findById(id)  
    }

    @Post()
    async create(@Body() createDto: CreateUserDto,  @User() currentUser: any, @Req() req: Request) {
        const ipAddress = req['clientIp'] || req.ip;
        return this.userService.createAdmin(createDto, currentUser.id, ipAddress);
    }

    @Put(':id')
    update(@Param('id') id: number, @Body() updateUserDto: UpdateUserDto, @Req() req: Request) {
      const ipAddress = req['clientIp'] || req.ip;
      return this.userService.update(id, updateUserDto, ipAddress);
    }

    @Delete(':id')
    remove(@Param('id') id: number, @User() currentUser: any, @Req() req: Request) {
      const ipAddress = req['clientIp'] || req.ip;
      return this.userService.delete(id, currentUser, ipAddress);
    }
}