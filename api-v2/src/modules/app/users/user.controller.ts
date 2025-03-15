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
    async findAll() {
      return this.userService.findAll();
    }

    @Get(':id')
    async findOne(@Param('id') id: number) {
      return this.userService.findById(id)  
    }

    @Post()
    async create(@Body() createDto: CreateUserDto,  @User() currentUser: any) {
        return this.userService.createAdmin(createDto, currentUser.id);
    }

    @Put(':id')
    update(@Param('id') id: number, @Body() updateUserDto: UpdateUserDto) {
      return this.userService.update(id, updateUserDto);
    }
  
    @Delete(':id')
    remove(@Param('id') id: number, @User() currentUser: any) {
      return this.userService.delete(id, currentUser);
    }
}