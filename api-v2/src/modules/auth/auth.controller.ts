import { Body, Controller, Inject, Post, ClassSerializerInterceptor, UseInterceptors, UseGuards, Req, Get, HttpStatus } from '@nestjs/common';
import { Request } from 'express';

import { RegisterDto, LoginDto, ChangePasswordDto } from './auth.dto';

import { AuthService } from './auth.service';
import { ApiTags } from '@nestjs/swagger';
import { UserService } from '../app/users/user.service';
import { AppUser } from 'src/entities/appuser.entity';
import { AuthGuard } from './auth.guard';
import { User } from 'src/core/decorator/user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  
  @Inject(AuthService)
  private readonly service: AuthService;
  @Inject(UserService)
  private readonly userService: UserService;

  @Post('register')
  @UseInterceptors(ClassSerializerInterceptor)
  private register(@Body() body: RegisterDto): Promise<AppUser | never> {
    return this.service.register(body);
  }

  @Post('login')
  private async login(@Body() body: LoginDto): Promise<AppUser | never> {
      return this.service.login(body);
  }  
  
  @Post('changepwd')
  private async changepwd(@Body() body: ChangePasswordDto): Promise<AppUser | never> {
      return this.service.changepwd(body);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  private me( @User() currentUser: any) {
    return this.userService.findBasicDetails(currentUser.id);
  }

  @Post('refresh')
  @UseGuards(AuthGuard)
  private refresh(@Req() request: Request): Promise<string | never> {
    return this.service.refresh(<AppUser>request['user']);
  }
}