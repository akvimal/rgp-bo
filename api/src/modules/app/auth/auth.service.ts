import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AppUser } from '../../../entities/appuser.entity';
import { Repository } from 'typeorm';
import { RegisterDto, LoginDto, ChangePasswordDto } from './auth.dto';
import { AuthHelper } from './auth.helper';

@Injectable()
export class AuthService {

  @Inject(AuthHelper)
  private readonly helper: AuthHelper;

  constructor(@InjectRepository(AppUser) private readonly userRepository: Repository<AppUser>){}

  public async register(body: RegisterDto): Promise<AppUser | never> {

    const { name, email, password }: RegisterDto = body;
    let user: AppUser = await this.userRepository.findOne({ where: { email } });

    if (user) {
      throw new HttpException('Conflict', HttpStatus.CONFLICT);
    }

    user = new AppUser();
    user.fullname = name;
    user.email = email;
    user.password = this.helper.encodePassword(password);

    return this.userRepository.save(user);
  }

  public async login(body: LoginDto): Promise<any | never> {
    const { email, password }: LoginDto = body;
    const user: AppUser = await this.userRepository.findOne({ where: { email } });
    console.log(user);
    
    if (!user) {
      throw new Error('Invalid Credentials');
    }

    const isPasswordValid: boolean = this.helper.isPasswordValid(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid Credentials');
    }

    this.userRepository.update(user.id, { lastlogin: new Date() });
    return {token: this.helper.generateToken(user)};
  }

  public async changepwd(body: ChangePasswordDto): Promise<any | never> {
    const { email, password, newpassword }: ChangePasswordDto = body;
    const user: AppUser = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new Error('Invalid Credentials');
    }

    const isPasswordValid: boolean = this.helper.isPasswordValid(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid Credentials');
    }

    this.userRepository.update(user.id, { password: this.helper.encodePassword(newpassword), lastlogin: new Date() });

    return {token: this.helper.generateToken(user)};
  }

  public async refresh(user: AppUser): Promise<string> {
    this.userRepository.update(user.id, { lastlogin: new Date() });
    return this.helper.generateToken(user);
  }
}