import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { User } from "../../../core/decorator/user.decorator";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserService } from "./user.service";

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class UserController {

    constructor(private userService:UserService){}

    @Get()
    async findAll() {
      return this.userService.findAll();
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
      return this.userService.findById(id)
    }

    @Post()
    async create(@Body() createDto: CreateUserDto,  @User() currentUser: any) {
        return this.userService.create(createDto, currentUser.id);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
      return this.userService.update(id, updateUserDto);
    }
  
    @Delete(':id')
    remove(@Param('id') id: string, @User() currentUser: any) {
      return this.userService.delete(id, currentUser);
    }
}