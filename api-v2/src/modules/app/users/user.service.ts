import { packsOf } from 'src/core/modules/modules';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AppUser } from "../../../entities/appuser.entity";
import { AppRole } from "../../../entities/approle.entity";
import { Store } from "../../../entities/store.entity";
import { UserStore } from "../../../entities/user-store.entity";
import { DeepPartial, In, Not, Repository } from "typeorm";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { AuthHelper } from "src/modules/auth/auth.helper";
import { ASSIGNABLE_BY_BUSINESS_HEAD, ASSIGNABLE_BY_SITE_ADMIN, OWNER_ROLES } from "src/core/roles";
import { forgetUser } from "src/core/active-users";
import { emailProblem, emailTakenMessage, removalBlock } from "src/core/user-rules";
import { ModulesService } from "src/core/modules/modules.service";
import { PlatformService } from "src/core/platform/platform.service";
import { filterPermissions } from "src/core/modules/modules";
import { businessOfUser } from "src/core/business-of-user";

@Injectable()
export class UserService {

  constructor(@InjectRepository(AppUser) private readonly userRepository: Repository<AppUser>,
  @InjectRepository(AppRole) private readonly roleRepository: Repository<AppRole>,
  @InjectRepository(Store) private readonly storeRepository: Repository<Store>,
  @InjectRepository(UserStore) private readonly userStoreRepository: Repository<UserStore>,
  private helper:AuthHelper,
  private readonly modules: ModulesService,
  private readonly platform: PlatformService) { }

  async createAdmin(createUserDto: CreateUserDto, userid:number) {
    if (!createUserDto.password) {
      throw new Error('Password is required');
    }
    const user = await this.userRepository.save({...createUserDto,
      password: this.helper.encodePassword(createUserDto.password),
      isResetPwd:true,
      createdby:userid});
    await this.updateStores(user.id, (createUserDto as any).storeids || [], userid);
    return user;
  }

  private async getCaller(userid: number) {
    const caller = await this.userRepository.findOne({ where: { id: userid }, relations: ['role'] });
    if (!caller) {
      throw new UnauthorizedException();
    }
    return caller;
  }

  /** an email that fits and is free: the login name is unique across every login, removed ones included */
  private async checkedEmail(email: any, exceptId?: number): Promise<string> {
    const r = emailProblem(email);
    if ('error' in r) throw new BadRequestException(r.error);
    const other = await this.userRepository.findOne({ where: { email: r.value } });
    if (other && other.id !== exceptId) throw new ConflictException(emailTakenMessage(other.isActive === false || other.isArchived === true));
    return r.value;
  }

  private async assertStoresBelongToBusiness(storeids: any[], businessid: number | null) {
    const ids = Array.isArray(storeids) ? storeids.map((s: any) => Number(s)).filter((s: number) => !!s) : [];
    if (!ids.length) {
      return;
    }
    if (!businessid) {
      throw new ForbiddenException('No business linked to your account');
    }
    const count = await this.storeRepository.count({ where: { id: In(ids), business: { id: businessid } } as any });
    if (count !== ids.length) {
      throw new ForbiddenException('One or more stores do not belong to your business');
    }
  }

  async createScoped(dto: CreateUserDto, currentUserId: number) {
    const caller = await this.getCaller(currentUserId);
    if (!dto.roleid) {
      throw new BadRequestException('Role is required');
    }
    const targetRole = await this.roleRepository.findOne({ where: { id: Number(dto.roleid) } });
    if (!targetRole) {
      throw new BadRequestException('Invalid role');
    }

    let businessid: number | null = null;

    if (caller.role?.name === 'Site Admin') {
      if (!ASSIGNABLE_BY_SITE_ADMIN.includes(targetRole.name)) {
        throw new ForbiddenException('Site Admin can only create Business Head or Owner-operator users');
      }
      if (dto.storeids && dto.storeids.length) {
        throw new ForbiddenException('Site Admin cannot assign stores');
      }
      businessid = dto.businessid ? Number(dto.businessid) : null;
      if (!businessid) {
        throw new BadRequestException('Business is required');
      }
    } else if (caller.role?.name === 'Business Head') {
      if (!ASSIGNABLE_BY_BUSINESS_HEAD.includes(targetRole.name)) {
        throw new ForbiddenException('Business Head can only create Store Head, Sales Staff, Counter or Personal users');
      }
      businessid = caller.businessid;
      await this.assertStoresBelongToBusiness(dto.storeids || [], businessid);
    } else {
      throw new ForbiddenException('Not permitted to create users');
    }

    const email = await this.checkedEmail(dto.email);

    // the shared till and self-service logins are not seats on a hosted plan
    if (!['Counter', 'Personal'].includes(targetRole.name)) await this.platform.assertRoom('users');
    if (!dto.password) {
      throw new BadRequestException('Password is required');
    }

    const user = await this.userRepository.save({
      fullname: dto.fullname,
      email,
      phone: dto.phone,
      location: dto.location,
      roleid: targetRole.id,
      businessid,
      password: this.helper.encodePassword(dto.password),
      isResetPwd: true,
      createdby: currentUserId,
    } as any);
    await this.updateStores(user.id, dto.storeids || [], currentUserId);
    return user;
  }

  async updateScoped(id: number, dto: any, currentUserId: number) {
    const caller = await this.getCaller(currentUserId);
    const target = await this.userRepository.findOne({ where: { id } });
    if (!target) {
      throw new BadRequestException('User not found');
    }
    // a changed email becomes the new login name: it must fit and be free (an unchanged one is left alone, whatever it looks like)
    if (dto.email !== undefined && dto.email !== target.email) dto.email = await this.checkedEmail(dto.email, target.id);

    if (caller.role?.name === 'Site Admin') {
      const targetRole = await this.roleRepository.findOne({ where: { id: target.roleid } });
      if (!ASSIGNABLE_BY_SITE_ADMIN.includes(targetRole?.name ?? "")) {
        throw new ForbiddenException('Site Admin can only edit Business Head or Owner-operator users');
      }
      if (dto.storeids && dto.storeids.length) {
        throw new ForbiddenException('Site Admin cannot assign stores');
      }
      return this.userRepository.update(id, {
        fullname: dto.fullname,
        email: dto.email,
        phone: dto.phone,
        location: dto.location,
        businessid: dto.businessid ? Number(dto.businessid) : target.businessid,
      });
    }

    if (caller.role?.name === 'Business Head') {
      if (target.businessid !== caller.businessid) {
        throw new ForbiddenException('You can only edit users in your own business');
      }
      let roleid = target.roleid;
      if (dto.roleid !== undefined && Number(dto.roleid) !== target.roleid) {
        const newRole = await this.roleRepository.findOne({ where: { id: Number(dto.roleid) } });
        if (!newRole || !ASSIGNABLE_BY_BUSINESS_HEAD.includes(newRole.name)) {
          throw new ForbiddenException('Business Head can only assign Store Head, Sales Staff, Counter or Personal roles');
        }
        roleid = newRole.id;
      }
      if (dto.storeids && dto.storeids.length) {
        await this.assertStoresBelongToBusiness(dto.storeids, caller.businessid);
      }
      return this.userRepository.update(id, {
        fullname: dto.fullname,
        email: dto.email,
        phone: dto.phone,
        location: dto.location,
        roleid,
      });
    }

    throw new ForbiddenException('Not permitted to edit users');
  }

  async updateStoresScoped(id: number, storeids: any[], currentUserId: number) {
    const caller = await this.getCaller(currentUserId);
    const target = await this.userRepository.findOne({ where: { id } });
    if (!target) {
      throw new BadRequestException('User not found');
    }

    if (caller.role?.name === 'Business Head') {
      if (target.businessid !== caller.businessid) {
        throw new ForbiddenException('You can only manage stores for users in your own business');
      }
      await this.assertStoresBelongToBusiness(storeids, caller.businessid);
      return this.updateStores(id, storeids, currentUserId);
    }

    throw new ForbiddenException('Not permitted to assign stores');
  }

  async deleteScoped(rawId: number, currentUserId: number) {
    // the route hands the id over as text, and a comparison of 10 with '10' would let someone remove themselves
    const id = Number(rawId);
    if (!Number.isInteger(id)) throw new BadRequestException('User not found');
    const caller = await this.getCaller(currentUserId);
    const target = await this.userRepository.findOne({ where: { id } });
    if (!target) {
      throw new BadRequestException('User not found');
    }

    if (caller.role?.name === 'Site Admin') {
      const targetRole = await this.roleRepository.findOne({ where: { id: target.roleid } });
      if (!ASSIGNABLE_BY_SITE_ADMIN.includes(targetRole?.name ?? "")) {
        throw new ForbiddenException('Site Admin can only remove Business Head or Owner-operator users');
      }
    } else if (caller.role?.name === 'Business Head') {
      if (target.businessid !== caller.businessid) {
        throw new ForbiddenException('You can only remove users in your own business');
      }
    } else {
      throw new ForbiddenException('Not permitted to remove users');
    }

    // never remove yourself, and never the last head of the business: nobody could sign in to manage it
    const targetRole = await this.roleRepository.findOne({ where: { id: target.roleid } });
    const headRoles = await this.roleRepository.find({ where: { name: In(OWNER_ROLES) } });
    const otherHeads = OWNER_ROLES.includes(targetRole?.name ?? '')
      ? await this.userRepository.count({ where: { businessid: target.businessid, roleid: In(headRoles.map(r => r.id)), isActive: true, isArchived: false, id: Not(id) } as any })
      : 0;
    const blocked = removalBlock(currentUserId, id, targetRole?.name, otherHeads);
    if (blocked) throw new BadRequestException(blocked);

    return this.delete(id, { id: currentUserId });
  }

  async findAll(currentUser?: { id: number }) {
    const qb = this.userRepository.createQueryBuilder('u')
    .leftJoin("u.role", "role")
    .leftJoin("u.business", "ownbusiness")
    .leftJoin("u.storeassignments", "us", "us.isprimary = true")
    .leftJoin("us.store", "store")
    .leftJoin("store.business", "storebusiness")
    .where('u.isActive = true and u.isArchived = false and role.isLocked = false');

    if (currentUser) {
      const caller = await this.userRepository.findOne({ where: { id: currentUser.id }, relations: ['role'] });
      if (caller?.role?.name === 'Site Admin') {
        qb.andWhere('role.name IN (:...rolenames)', { rolenames: ASSIGNABLE_BY_SITE_ADMIN });
      } else {
        // everyone else sees the people of their own business only (an Owner-operator or Store Head has no business column of their own: it comes from their store)
        const businessid = await businessOfUser(this.userRepository.manager, currentUser.id);
        if (businessid) qb.andWhere('COALESCE(ownbusiness.id, storebusiness.id) = :businessid', { businessid });
        else qb.andWhere('u.id = :self', { self: currentUser.id });
      }
    }

    return qb.select([
      'u.id as id',
      'u.fullname as fullname',
      'u.email as email',
      'u.phone as phone',
      'u.location as location',
      'role.name as role',
      'store.id as store_id',
      'store.location as store',
      'COALESCE(ownbusiness.id, storebusiness.id) as business_id',
      'COALESCE(ownbusiness.name, storebusiness.name) as business',
    ])
    .getRawMany();
  }

  // findAllByOrganization(orgId:string) {
  //   if(orgId === '0')
  //     return this.userRepository.find({where:{orgid:null,isActive:true}})
  //   return this.userRepository.find({where:{orgid:+orgId,isActive:true}})
  // }

  findById(id:number) {
    return this.userRepository.createQueryBuilder('u')
      .leftJoinAndSelect("u.role", "role")
      .leftJoinAndSelect("u.storeassignments", "storeassignments")
      .leftJoinAndSelect("storeassignments.store", "store")
      .where('u.id = :id', { id })
      .getOne();
  }

  /** One person for the screen that asks: yourself, anyone in your own business, or (the platform's Site Admin) the first logins of businesses. Anyone else's id is not found. */
  async findByIdFor(id: number, currentUser: { id: number }) {
    const found = await this.findById(id);
    if (!found) return found;
    if (Number(id) === Number(currentUser?.id)) return found;
    const caller = await this.userRepository.findOne({ where: { id: currentUser?.id }, relations: ['role'] });
    if (caller?.role?.name === 'Site Admin') return found;
    const manager = this.userRepository.manager;
    const [mine, theirs] = await Promise.all([businessOfUser(manager, currentUser?.id), businessOfUser(manager, Number(id))]);
    if (!mine || mine !== theirs) throw new ForbiddenException('That person is not in your business.');
    return found;
  }

  async findByUsername(username:string) {
    // Need to explicitly select password field for authentication
    // since it's marked with @Exclude() in the entity
    return this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.email = :email', { email: username })
      .addSelect('user.password')
      .getOne();
  }

  async findBasicDetails(id:string) {

    const data = await this.userRepository.createQueryBuilder('u')
    .leftJoinAndSelect("u.role", "role")
    .leftJoin("u.business", "business")
    .where('u.isActive = true and u.id = :id', {id})
    .select(['u.id as user_id', 'u.fullname as fullname',
    'u.lastlogin as lastlogin', 'role.name as rolename',
    'role.permissions as permissions', 'u.business_id as businessid',
    'business.name as businessname', 'business.businesstype as businesstype'])
    .getRawOne();

    // the role as stored, narrowed to the modules this business has switched on (menus, buttons and routes follow it)
    const modules = await this.modules.forUser(Number(id));
    // GST: whether the business issues tax invoices and from when (the till then asks for the buyer's GSTIN)
    const [reg] = data.businessid ? await this.userRepository.manager.query(
      `select r.reg_type, to_char(r.go_live, 'YYYY-MM-DD') as go_live, b.state_code from gst_registration r join business b on b.id = r.business_id where r.business_id = $1`, [data.businessid]) : [];
    return {id:data.user_id, fullname: data.fullname,
      lastlogin:data.lastlogin,rolename:data.rolename,
      permissions:filterPermissions(data.permissions, modules), modules, platform: this.platform.summary(), businessid:data.businessid,
      businessname:data.businessname,
      // the kind of business and its packs: the app shows a pack's screens, fields and words only to a business that has it
      businesstype: data.businesstype || 'pharmacy', packs: packsOf(data.businesstype),
      gst: { registered: reg?.reg_type === 'registered', go_live: reg?.go_live ?? null, state_code: reg?.state_code ?? null }};
  }

  async update(id:number, updateUserDto:UpdateUserDto){
    return this.userRepository.update(id, updateUserDto);
  }

  async updateStores(id:number, storeids:any[], userid:number) {
    const ids = Array.isArray(storeids) ? storeids.map((s:any) => Number(s)).filter((s:number) => !!s) : [];
    await this.userStoreRepository.delete({ userid: id } as any);
    if (!ids.length) {
      return [];
    }
    const assignments = ids.map((storeid:number, index:number) => ({
      userid: id,
      storeid,
      isprimary: index === 0,
      createdby: userid,
      updatedby: userid,
    }));
    return this.userStoreRepository.save(assignments as any);
  }

  /**
   * Soft delete user with transaction protection
   * Fixed: Multi-step read-modify-write now atomic, preventing partial updates
   */
  async delete(id:number, currentUser:any){
    return await this.userRepository.manager.transaction('SERIALIZABLE', async (transactionManager) => {
      try {
        const obj = await transactionManager.findOne(AppUser, {where:{id}});
        if(!obj){
          throw new Error(`User with id ${id} not found`);
        }
        obj.isActive = false;
        obj.updatedby = currentUser.id;
        const saved = await transactionManager.save(AppUser, obj as DeepPartial<AppUser>);
        forgetUser(id);
        return saved;
      } catch (error) {
        // Transaction will automatically rollback on error
        throw new Error(`Failed to delete user: ${error.message}`);
      }
    });
  }

  // public async changePassword(body: ChangePasswordeDto, req: Request): Promise<AppUser> {
  //   const user: AppUser = <AppUser>req['user'];
  //   user['password'] = body.password;
  //   return this.userRepository.save(user);
  // }
}
