import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DeepPartial, Repository } from "typeorm";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { AppRole } from "src/entities/approle.entity";
import { BUILT_IN_ROLES } from "src/core/roles";

@Injectable()
export class RoleService {

  constructor(@InjectRepository(AppRole) private readonly roleRepository: Repository<AppRole>) { }

  async create(createRoleDto: CreateRoleDto,userid) {
    return this.roleRepository.save({...createRoleDto, createdby:userid});
  }

  /** every role, with how many active logins hold it (the app hides the kinds of role a shop does not use) */
  async findAll() {
    const roles = await this.roleRepository.createQueryBuilder('r')
            .where(`r.isLocked = :flag and r.isArchived = false`, { flag: false }).getMany();
    const used = await this.roleRepository.manager.query(`select role_id, count(*)::int as n from app_user where active and not archive group by role_id`);
    const count = new Map<number, number>(used.map((u: any) => [u.role_id, u.n]));
    return roles.map((r) => ({ ...r, usercount: count.get(r.id) ?? 0, builtin: BUILT_IN_ROLES.includes(r.name) }));
  }

  findById(id:number) {
    return this.roleRepository.findOne({where:{id}});
  }

  update(id:string, updateRoleDto:UpdateRoleDto){
    return this.roleRepository.update(id, updateRoleDto);
  }

  async delete(id:number, currentUser:any){
    const obj = await this.roleRepository.findOne({where:{id}});
    if (obj && BUILT_IN_ROLES.includes(obj.name)) throw new ForbiddenException(`${obj.name} is a built-in role and cannot be deleted.`);
    if (obj) {
      const [held] = await this.roleRepository.manager.query(`select count(*)::int as n from app_user where role_id = $1 and active and not archive`, [id]);
      if (held.n > 0) throw new ConflictException(`${held.n} login${held.n === 1 ? ' holds' : 's hold'} this role. Move ${held.n === 1 ? 'it' : 'them'} to another role first.`);
    }
    if(obj){
      obj.isActive = false;
      obj.isArchived = true;
      obj.updatedby = currentUser.id;
    }
    return this.roleRepository.save(obj as DeepPartial<AppRole>);
  }

}