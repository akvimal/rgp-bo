import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";

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
    async create(@Body() createDto: CreateRoleDto,  @User() currentUser: any) {
        return this.roleService.create(createDto, currentUser.id);
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
    update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
      return this.roleService.update(id, updateRoleDto);
    }
    
    @Delete(':id')
    remove(@Param('id') id: string, @User() currentUser: any) {
      return this.roleService.delete(Number(id), currentUser);
    }
}