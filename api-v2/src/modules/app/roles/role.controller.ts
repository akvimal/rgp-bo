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

    /** the starter roles not created yet */
    @Get('templates')
    templates(@User() currentUser: any) {
      return this.roleService.templates(currentUser.id);
    }

    @Post('templates')
    createFromTemplates(@Body() body: any, @User() currentUser: any) {
      return this.roleService.createFromTemplates(body?.names, currentUser.id);
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
      return this.roleService.findById(Number(id))
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto, @User() currentUser: any) {
      return this.roleService.update(id, updateRoleDto, currentUser.id);
    }
    
    @Delete(':id')
    remove(@Param('id') id: string, @User() currentUser: any) {
      return this.roleService.delete(Number(id), currentUser);
    }
}