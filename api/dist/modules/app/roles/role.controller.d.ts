import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { RoleService } from "./role.service";
export declare class RoleController {
    private roleService;
    constructor(roleService: RoleService);
    create(createDto: CreateRoleDto, currentUser: any): Promise<{
        createdby: any;
        name: string;
        permissions: object;
        locked: boolean;
    } & import("../../../entities/approle.entity").AppRole>;
    findAll(currentUser: any): Promise<import("../../../entities/approle.entity").AppRole[]>;
    findOne(id: string): Promise<import("../../../entities/approle.entity").AppRole>;
    update(id: string, updateRoleDto: UpdateRoleDto): Promise<import("typeorm").UpdateResult>;
    remove(id: string, currentUser: any): Promise<import("../../../entities/approle.entity").AppRole>;
}
