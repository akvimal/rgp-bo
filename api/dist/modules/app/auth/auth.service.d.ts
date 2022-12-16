import { AppUser } from 'src/entities/AppUser.entity';
import { Repository } from 'typeorm';
import { RegisterDto, LoginDto, ChangePasswordDto } from './auth.dto';
export declare class AuthService {
    private readonly userRepository;
    private readonly helper;
    constructor(userRepository: Repository<AppUser>);
    register(body: RegisterDto): Promise<AppUser | never>;
    login(body: LoginDto): Promise<any | never>;
    changepwd(body: ChangePasswordDto): Promise<any | never>;
    refresh(user: AppUser): Promise<string>;
}
