import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AppUser } from "../../../entities/appuser.entity";
import { AppRole } from "../../../entities/approle.entity";
import { Store } from "../../../entities/store.entity";
import { UserStore } from "../../../entities/user-store.entity";
import { DeepPartial, In, Repository } from "typeorm";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { AuthHelper } from "src/modules/auth/auth.helper";

@Injectable()
export class UserService {

  constructor(@InjectRepository(AppUser) private readonly userRepository: Repository<AppUser>,
  @InjectRepository(AppRole) private readonly roleRepository: Repository<AppRole>,
  @InjectRepository(Store) private readonly storeRepository: Repository<Store>,
  @InjectRepository(UserStore) private readonly userStoreRepository: Repository<UserStore>,
  private helper:AuthHelper) { }

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
      if (targetRole.name !== 'Business Head') {
        throw new ForbiddenException('Site Admin can only create Business Head users');
      }
      if (dto.storeids && dto.storeids.length) {
        throw new ForbiddenException('Site Admin cannot assign stores');
      }
      businessid = dto.businessid ? Number(dto.businessid) : null;
      if (!businessid) {
        throw new BadRequestException('Business is required');
      }
    } else if (caller.role?.name === 'Business Head') {
      if (!['Store Head', 'Sales Staff'].includes(targetRole.name)) {
        throw new ForbiddenException('Business Head can only create Store Head or Sales Staff users');
      }
      businessid = caller.businessid;
      await this.assertStoresBelongToBusiness(dto.storeids || [], businessid);
    } else {
      throw new ForbiddenException('Not permitted to create users');
    }

    if (!dto.password) {
      throw new BadRequestException('Password is required');
    }

    const user = await this.userRepository.save({
      fullname: dto.fullname,
      email: dto.email,
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

    if (caller.role?.name === 'Site Admin') {
      const targetRole = await this.roleRepository.findOne({ where: { id: target.roleid } });
      if (targetRole?.name !== 'Business Head') {
        throw new ForbiddenException('Site Admin can only edit Business Head users');
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
        if (!newRole || !['Store Head', 'Sales Staff'].includes(newRole.name)) {
          throw new ForbiddenException('Business Head can only assign Store Head or Sales Staff roles');
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

  async deleteScoped(id: number, currentUserId: number) {
    const caller = await this.getCaller(currentUserId);
    const target = await this.userRepository.findOne({ where: { id } });
    if (!target) {
      throw new BadRequestException('User not found');
    }

    if (caller.role?.name === 'Site Admin') {
      const targetRole = await this.roleRepository.findOne({ where: { id: target.roleid } });
      if (targetRole?.name !== 'Business Head') {
        throw new ForbiddenException('Site Admin can only remove Business Head users');
      }
    } else if (caller.role?.name === 'Business Head') {
      if (target.businessid !== caller.businessid) {
        throw new ForbiddenException('You can only remove users in your own business');
      }
    } else {
      throw new ForbiddenException('Not permitted to remove users');
    }

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
      if (caller?.role?.name === 'Business Head') {
        qb.andWhere('u.business_id = :businessid', { businessid: caller.businessid });
      } else if (caller?.role?.name === 'Site Admin') {
        qb.andWhere('role.name = :rolename', { rolename: 'Business Head' });
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

  async findByUsername(username:string) {
    // Need to explicitly select password field for authentication
    // since it's marked with @Exclude() in the entity
    return this.userRepository
      .createQueryBuilder('user')
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
    'business.name as businessname'])
    .getRawOne();

    return {id:data.user_id, fullname: data.fullname,
      lastlogin:data.lastlogin,rolename:data.rolename,
      permissions:data.permissions, businessid:data.businessid,
      businessname:data.businessname};
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
        return await transactionManager.save(AppUser, obj as DeepPartial<AppUser>);
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
