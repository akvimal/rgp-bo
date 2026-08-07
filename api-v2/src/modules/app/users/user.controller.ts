import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";

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
    async findAll(@User() currentUser: any) {
      return this.userService.findAll(currentUser);
    }

    @Get(':id')
    async findOne(@Param('id') id: number) {
      return this.userService.findById(id)
    }

    @Post()
    async create(@Body() createDto: CreateUserDto,  @User() currentUser: any) {
        return this.userService.createScoped(createDto, currentUser.id);
    }

    @Put(':id')
    async update(@Param('id') id: number, @Body() updateUserDto: any, @User() currentUser: any) {
      const result = await this.userService.updateScoped(id, updateUserDto, currentUser.id);
      if (updateUserDto?.storeids !== undefined) {
        await this.userService.updateStoresScoped(id, updateUserDto.storeids || [], currentUser.id);
      }
      return result;
    }

    @Put(':id/stores')
    updateStores(@Param('id') id: number, @Body() body: any, @User() currentUser: any) {
      return this.userService.updateStoresScoped(id, body?.storeids || [], currentUser.id);
    }

    @Delete(':id')
    remove(@Param('id') id: number, @User() currentUser: any) {
      return this.userService.deleteScoped(id, currentUser.id);
    }
}
