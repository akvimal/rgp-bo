import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AppUser } from "../../../entities/appuser.entity";
import { DeepPartial, Repository } from "typeorm";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { AuthHelper } from "src/modules/auth/auth.helper";
import { AuditService } from "src/core/audit/audit.service";

@Injectable()
export class UserService {

  constructor(@InjectRepository(AppUser) private readonly userRepository: Repository<AppUser>,
  private helper:AuthHelper,
  private auditService: AuditService) { }

  async createAdmin(createUserDto: CreateUserDto, userid:number, ipAddress?: string) {
    if (!createUserDto.password) {
      throw new Error('Password is required');
    }
    const user = await this.userRepository.save({...createUserDto,
      password: this.helper.encodePassword(createUserDto.password),
      isResetPwd:true,
      createdby:userid});

    // Log audit
    console.log('[UserService] About to log audit for user creation, user ID:', user.id, 'IP:', ipAddress);
    try {
      await this.auditService.logUserAction({
        userId: userid,
        action: 'USER_CREATE',
        targetUserId: user.id,
        newValues: {
          email: user.email,
          fullname: user.fullname,
          roleid: user.roleid,
          phone: user.phone,
          location: user.location
        },
        ipAddress: ipAddress,
      });
      console.log('[UserService] Audit log completed successfully');
    } catch (error) {
      console.error('[UserService] FAILED to log audit:', error);
    }

    return user;
  }
  
  async create(createUserDto: CreateUserDto) {
    if (!createUserDto.password) {
      throw new Error('Password is required');
    }
    return this.userRepository.save({...createUserDto, 
      password: this.helper.encodePassword(createUserDto.password),
      isResetPwd:true});
  }

  findAll() {
    return this.userRepository.createQueryBuilder('u')
    .leftJoinAndSelect("u.role", "role")
    .where('u.isActive = true and u.isArchived = false and role.isLocked = false')
    .select(['u.id as id',
    'u.fullname as fullname', 'u.email as email', 'u.phone as phone', 
    'u.location as location', 'role.name as role', ])
    .getRawMany();
  }

  // findAllByOrganization(orgId:string) {
  //   if(orgId === '0')
  //     return this.userRepository.find({where:{orgid:null,isActive:true}})
  //   return this.userRepository.find({where:{orgid:+orgId,isActive:true}})
  // }

  findById(id:number) {
    return this.userRepository.findOne({where:{id}});
  }

  async findByUsername(username:string) {
    return this.userRepository.findOne({ where: { email:username } });
  }

  async findBasicDetails(id:string) {
    
    const data = await this.userRepository.createQueryBuilder('u')
    .leftJoinAndSelect("u.role", "role")
    .where('u.isActive = true and u.id = :id', {id})
    .select(['u.id as user_id', 'u.fullname as fullname',
    'u.lastlogin as lastlogin', 'role.name as rolename', 
    'role.permissions as permissions'])
    .getRawOne();
    
    return {id:data.user_id, fullname: data.fullname,
      lastlogin:data.lastlogin,rolename:data.rolename,
      permissions:data.permissions};
  }

  async update(id:number, updateUserDto:UpdateUserDto, ipAddress?: string){
    // Get old values before update
    const oldUser = await this.userRepository.findOne({where:{id}});

    // Perform update
    await this.userRepository.update(id, updateUserDto);

    // Get new values after update
    const newUser = await this.userRepository.findOne({where:{id}});

    // Log audit with before/after state
    if (oldUser && newUser) {
      await this.auditService.logUserAction({
        userId: null, // TODO: Get current user ID from context
        action: 'USER_UPDATE',
        targetUserId: id,
        oldValues: {
          email: oldUser.email,
          fullname: oldUser.fullname,
          roleid: oldUser.roleid,
          phone: oldUser.phone,
          location: oldUser.location,
          isActive: oldUser.isActive
        },
        newValues: {
          email: newUser.email,
          fullname: newUser.fullname,
          roleid: newUser.roleid,
          phone: newUser.phone,
          location: newUser.location,
          isActive: newUser.isActive
        },
        ipAddress: ipAddress,
      });
    }

    return newUser;
  }

  async delete(id:number, currentUser:any, ipAddress?: string){
    const obj = await this.userRepository.findOne({where:{id}});
    if(obj){
      obj.isActive = false;
      obj.updatedby = currentUser.id;

      const result = await this.userRepository.save(obj as DeepPartial<AppUser>);

      // Log audit
      await this.auditService.logUserAction({
        userId: currentUser.id,
        action: 'USER_DELETE',
        targetUserId: id,
        oldValues: { isActive: true },
        newValues: { isActive: false },
        ipAddress: ipAddress,
      });

      return result;
    }
    return obj;
  }

  // public async changePassword(body: ChangePasswordeDto, req: Request): Promise<AppUser> {
  //   const user: AppUser = <AppUser>req['user'];
  //   user['password'] = body.password;
  //   return this.userRepository.save(user);
  // }
}