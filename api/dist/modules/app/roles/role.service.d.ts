import { Repository } from "typeorm";
import { AppRole } from "src/entities/approle.entity";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
export declare class RoleService {
    private readonly roleRepository;
    constructor(roleRepository: Repository<AppRole>);
    create(createRoleDto: CreateRoleDto, userid: any): Promise<{
        createdby: any;
        name: string;
        permissions: object;
        locked: boolean;
    } & AppRole>;
    findAll(): Promise<AppRole[]>;
    findById(id: string): Promise<AppRole>;
    update(id: string, updateRoleDto: UpdateRoleDto): Promise<import("typeorm").UpdateResult>;
    delete(id: string, currentUser: any): Promise<AppRole>;
}
