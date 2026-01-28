import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DeepPartial, Repository } from "typeorm";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { AppRole } from "src/entities/approle.entity";
import { AuditService } from "src/core/audit/audit.service";

@Injectable()
export class RoleService {

  constructor(@InjectRepository(AppRole) private readonly roleRepository: Repository<AppRole>,
  private auditService: AuditService) { }

  async create(createRoleDto: CreateRoleDto,userid, ipAddress?: string) {
    const role = await this.roleRepository.save({...createRoleDto, createdby:userid});

    // Log audit
    await this.auditService.logRoleAction({
      userId: userid,
      action: 'ROLE_CREATE',
      roleId: role.id,
      newValues: {
        name: role.name,
        permissions: role.permissions
      },
      ipAddress: ipAddress,
    });

    return role;
  }

  findAll() {
    return this.roleRepository.createQueryBuilder('r')
            .where(`r.isLocked = :flag and r.isArchived = false`, { flag: false }).getMany();
  }

  findById(id:number) {
    return this.roleRepository.findOne({where:{id}});
  }

  async update(id:string, updateRoleDto:UpdateRoleDto, ipAddress?: string){
    // Get old values before update
    const oldRole = await this.roleRepository.findOne({where:{id: +id}});

    // Perform update
    await this.roleRepository.update(id, updateRoleDto);

    // Get new values after update
    const newRole = await this.roleRepository.findOne({where:{id: +id}});

    // Log audit with before/after state (especially permissions diff)
    if (oldRole && newRole) {
      await this.auditService.logRoleAction({
        userId: null, // TODO: Get current user ID from context
        action: 'ROLE_UPDATE',
        roleId: +id,
        oldValues: {
          name: oldRole.name,
          permissions: oldRole.permissions
        },
        newValues: {
          name: newRole.name,
          permissions: newRole.permissions
        },
        ipAddress: ipAddress,
      });
    }

    return newRole;
  }

  async delete(id:number, currentUser:any, ipAddress?: string){
    const obj = await this.roleRepository.findOne({where:{id}});
    if(obj){
      obj.isActive = false;
      obj.isArchived = true;
      obj.updatedby = currentUser.id;

      const result = await this.roleRepository.save(obj as DeepPartial<AppRole>);

      // Log audit
      await this.auditService.logRoleAction({
        userId: currentUser.id,
        action: 'ROLE_DELETE',
        roleId: id,
        oldValues: {
          isActive: true,
          isArchived: false
        },
        newValues: {
          isActive: false,
          isArchived: true
        },
        ipAddress: ipAddress,
      });

      return result;
    }
    return obj;
  }

}