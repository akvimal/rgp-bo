import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DeepPartial, Repository } from "typeorm";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { AppRole } from "src/entities/approle.entity";
import { BUILT_IN_ROLES } from "src/core/roles";
import { grants, overreach, permsOf, RESERVED_ROLES } from "src/core/role-rules";
import { templateByName, templatesToOffer } from "./role-templates";

@Injectable()
export class RoleService {

  constructor(@InjectRepository(AppRole) private readonly roleRepository: Repository<AppRole>) { }

  /** who is asking: their role's name and permissions, from the database (the token only says who they were when they signed in) */
  private async callerOf(userid: number) {
    const [row] = await this.roleRepository.manager.query(
      `select r.id, r.name, r.permissions from app_user u join app_role r on r.id = u.role_id where u.id = $1 and u.active and not u.archive`, [userid]);
    if (!row) throw new ForbiddenException('Not permitted');
    return { name: row.name as string, perms: permsOf(row) };
  }

  /** the caller must hold the right on roles, and may not hand out more than they hold */
  private async assertMay(userid: number, action: 'add' | 'edit' | 'delete', newPerms?: any) {
    const c = await this.callerOf(userid);
    if (!grants(c.perms, 'roles', action) && c.name !== 'Site Admin') throw new ForbiddenException('You do not have permission to change roles.');
    if (newPerms !== undefined) {
      const over = overreach(c.name, c.perms, permsOf({ permissions: newPerms }));
      if (over.length) throw new ForbiddenException(`A role cannot allow more than you can do yourself: ${over.slice(0, 5).join(', ')}${over.length > 5 ? ' ...' : ''}.`);
    }
    return c;
  }

  async create(createRoleDto: CreateRoleDto,userid) {
    await this.assertMay(userid, 'add', createRoleDto.permissions);
    const name = String(createRoleDto.name || '').trim();
    if (!name) throw new BadRequestException('A role needs a name.');
    if (BUILT_IN_ROLES.includes(name)) throw new ConflictException(`${name} is a built-in role.`);
    const clash = await this.roleRepository.findOne({ where: { name } });
    if (clash && !clash.isArchived) throw new ConflictException(`A role called ${name} already exists.`);
    if (clash) {
      // a deleted role keeps its name (names are unique): creating it again brings it back with the new permissions
      await this.roleRepository.update(clash.id, { permissions: createRoleDto.permissions, isArchived: false, isActive: true, updatedby: userid } as any);
      return this.roleRepository.findOne({ where: { id: clash.id } });
    }
    return this.roleRepository.save({...createRoleDto, name, createdby:userid});
  }

  /** the starter roles: which are offered (not yet created) and what each allows */
  async templates(userid: number) {
    // a one-person shop (the Owner-operator) has no staff to build roles for
    if ((await this.callerOf(userid)).name === 'Owner-operator') return [];
    const names = (await this.roleRepository.find({ where: { isArchived: false } })).map((r) => r.name);
    return templatesToOffer(names).map((t) => ({ name: t.name, blurb: t.blurb }));
  }

  /** create the chosen starter roles; one that already exists is skipped */
  async createFromTemplates(names: string[], userid: number) {
    const made: string[] = [];
    for (const n of Array.isArray(names) ? names : []) {
      const t = templateByName(n);
      if (!t) throw new BadRequestException(`${n} is not a starter role.`);
      if (!(await this.roleRepository.findOne({ where: { name: t.name, isArchived: false } }))) {
        await this.create({ name: t.name, permissions: t.permissions, locked: false } as any, userid);
        made.push(t.name);
      }
    }
    return { created: made };
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

  async update(id:string, updateRoleDto:UpdateRoleDto, userid: number){
    const c = await this.assertMay(userid, 'edit', (updateRoleDto as any).permissions);
    const role = await this.roleRepository.findOne({ where: { id: Number(id) } });
    if (role && RESERVED_ROLES.includes(role.name) && c.name !== 'Site Admin') throw new ForbiddenException(`${role.name} is set up by your platform administrator and cannot be changed here.`);
    return this.roleRepository.update(id, updateRoleDto);
  }

  async delete(id:number, currentUser:any){
    await this.assertMay(currentUser.id, 'delete');
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