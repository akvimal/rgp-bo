import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { AppUser } from "../../../entities/AppUser.entity";
import { Repository } from "typeorm";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { ChangePasswordeDto } from "./dto/change-password.dto";
import { Request } from "express";
import { AuthHelper } from "../auth/auth.helper";

@Injectable()
export class UserService {

  constructor(@InjectRepository(AppUser) private readonly userRepository: Repository<AppUser>,
  private helper:AuthHelper) { }

  async create(createUserDto: CreateUserDto,userid) {
    return this.userRepository.save({...createUserDto, 
      password: this.helper.encodePassword(createUserDto.password),
      isResetPwd:true,
      createdby:userid});
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

  findAllByOrganization(orgId:string) {
    if(orgId === '0')
      return this.userRepository.find({where:{orgid:null,isActive:true}})
    return this.userRepository.find({where:{orgid:+orgId,isActive:true}})
  }

  findById(id:string) {
    return this.userRepository.findOne(id);
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

  update(id:string, updateUserDto:UpdateUserDto){
    return this.userRepository.update(id, updateUserDto);
  }

  async delete(id:string, currentUser:any){
    const obj = await this.userRepository.findOne(id);
    if(obj){
      obj.isActive = false;
      obj.updatedby = currentUser.id;
    }
    return this.userRepository.save(obj);
  }

  public async changePassword(body: ChangePasswordeDto, req: Request): Promise<AppUser> {
    const user: AppUser = <AppUser>req.user;
    user.password = body.password;
    return this.userRepository.save(user);
  }
}