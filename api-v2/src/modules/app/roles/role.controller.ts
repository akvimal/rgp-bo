import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, Req } from "@nestjs/common";
import { Request } from 'express';

import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { User } from "../../../core/decorator/user.decorator";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { RoleService } from "./role.service";
import { AuthGuard } from "src/modules/auth/auth.guard";

@ApiTags('Roles')
@Controller('roles')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class RoleController {

    constructor(private roleService:RoleService){}
    
    @Post()
    async create(@Body() createDto: CreateRoleDto,  @User() currentUser: any, @Req() req: Request) {
        const ipAddress = req['clientIp'] || req.ip;
        return this.roleService.create(createDto, currentUser.id, ipAddress);
    }

    @Get()
    async findAll(@User() currentUser: any) {
      return this.roleService.findAll();
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
      return this.roleService.findById(Number(id))
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto, @Req() req: Request) {
      const ipAddress = req['clientIp'] || req.ip;
      return this.roleService.update(id, updateRoleDto, ipAddress);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @User() currentUser: any, @Req() req: Request) {
      const ipAddress = req['clientIp'] || req.ip;
      return this.roleService.delete(Number(id), currentUser, ipAddress);
    }
}