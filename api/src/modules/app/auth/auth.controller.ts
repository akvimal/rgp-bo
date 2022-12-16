import { Body, Controller, Inject, Post, ClassSerializerInterceptor, UseInterceptors, UseGuards, Req, Get, HttpStatus } from '@nestjs/common';
import { Request, response } from 'express';

import { RegisterDto, LoginDto, ChangePasswordDto } from './auth.dto';
import { JwtAuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { AppUser } from '../../../entities/AppUser.entity';
import { ApiTags } from '@nestjs/swagger';
import { UserService } from '../users/user.service';
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
  @UseGuards(JwtAuthGuard)
  private me( @User() currentUser: any) {
    return this.userService.findBasicDetails(currentUser.id);
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  private refresh(@Req() { user }: Request): Promise<string | never> {
    return this.service.refresh(<AppUser>user);
  }
}