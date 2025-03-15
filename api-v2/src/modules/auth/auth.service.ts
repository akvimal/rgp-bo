import { HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';

import { AppUser } from 'src/entities/appuser.entity';

import { AuthHelper } from './auth.helper';
import { ChangePasswordDto, LoginDto, RegisterDto } from './auth.dto';
import { UserService } from '../app/users/user.service';

@Injectable()
export class AuthService {

  @Inject(AuthHelper)
  private readonly helper: AuthHelper;

  constructor(
    private readonly userService: UserService){}

  public async register(body: RegisterDto): Promise<AppUser | never> {

    const { name, email }: RegisterDto = body;
    let user = await this.userService.findByUsername(email);

    if (user) {
      throw new HttpException('Conflict', HttpStatus.CONFLICT);
    }
  
    const password = this.helper.encodePassword(body['password']);

    return this.userService.create({fullname:name,password,email});
  }

  public async login(body: LoginDto): Promise<any | never> {
    const { email, password }: LoginDto = body;
    const user = await this.userService.findByUsername(email );
    if (!user) {
      // throw new Error('Invalid Credentials');
      throw new UnauthorizedException();
    }

    const isPasswordValid: boolean = this.helper.isPasswordValid(password, user.password);
    if (!isPasswordValid) {
      // throw new Error('Invalid Credentials');
      throw new UnauthorizedException();
    }

    this.userService.update(user.id, { lastlogin: new Date() });
    return {token: this.helper.generateToken(user)};
  }

  public async changepwd(body: ChangePasswordDto): Promise<any | never> {
    const { email, password, newpassword }: ChangePasswordDto = body;
    const user = await this.userService.findByUsername(email);
    if (!user) {
      throw new Error('Invalid Credentials');
    }

    const isPasswordValid: boolean = this.helper.isPasswordValid(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid Credentials');
    }

    this.userService.update(user.id, { password: this.helper.encodePassword(newpassword), lastlogin: new Date() });

    return {token: this.helper.generateToken(user)};
  }

  public async refresh(user: AppUser): Promise<string> {
    this.userService.update(user.id, { lastlogin: new Date() });
    return this.helper.generateToken(user);
  }
}