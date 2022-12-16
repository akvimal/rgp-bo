import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserService } from "./user.service";
export declare class UserController {
    private userService;
    constructor(userService: UserService);
    findAll(): Promise<any[]>;
    findOne(id: string): Promise<import("../../../entities/AppUser.entity").AppUser>;
    create(createDto: CreateUserDto, currentUser: any): Promise<{
        password: string;
        isResetPwd: boolean;
        createdby: any;
        fullname: string;
        email: string;
        phone: string;
        location: string;
        roleid: number;
    } & import("../../../entities/AppUser.entity").AppUser>;
    update(id: string, updateUserDto: UpdateUserDto): Promise<import("typeorm").UpdateResult>;
    remove(id: string, currentUser: any): Promise<import("../../../entities/AppUser.entity").AppUser>;
}
