import { AppUser } from "../../../entities/AppUser.entity";
import { Repository } from "typeorm";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { ChangePasswordeDto } from "./dto/change-password.dto";
import { Request } from "express";
import { AuthHelper } from "../auth/auth.helper";
export declare class UserService {
    private readonly userRepository;
    private helper;
    constructor(userRepository: Repository<AppUser>, helper: AuthHelper);
    create(createUserDto: CreateUserDto, userid: any): Promise<{
        password: string;
        isResetPwd: boolean;
        createdby: any;
        fullname: string;
        email: string;
        phone: string;
        location: string;
        roleid: number;
    } & AppUser>;
    findAll(): Promise<any[]>;
    findAllByOrganization(orgId: string): Promise<AppUser[]>;
    findById(id: string): Promise<AppUser>;
    findBasicDetails(id: string): Promise<{
        id: any;
        fullname: any;
        lastlogin: any;
        rolename: any;
        permissions: any;
    }>;
    update(id: string, updateUserDto: UpdateUserDto): Promise<import("typeorm").UpdateResult>;
    delete(id: string, currentUser: any): Promise<AppUser>;
    changePassword(body: ChangePasswordeDto, req: Request): Promise<AppUser>;
}
