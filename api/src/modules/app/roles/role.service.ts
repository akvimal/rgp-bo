import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AppRole } from "../../../entities/approle.entity";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";

@Injectable()
export class RoleService {

  constructor(@InjectRepository(AppRole) private readonly roleRepository: Repository<AppRole>) { }

  async create(createRoleDto: CreateRoleDto,userid) {
    return this.roleRepository.save({...createRoleDto, createdby:userid});
  }

  findAll() {
    return this.roleRepository.createQueryBuilder('r')
            .where(`r.isLocked = :flag and r.isArchived = false`, { flag: false }).getMany();
  }

  findById(id:string) {
    return this.roleRepository.findOne(id);
  }

  update(id:string, updateRoleDto:UpdateRoleDto){
    return this.roleRepository.update(id, updateRoleDto);
  }

  async delete(id:string, currentUser:any){
    const obj = await this.roleRepository.findOne(id);
    if(obj){
      obj.isActive = false;
      obj.isArchived = true;
      obj.updatedby = currentUser.id;
    }
    return this.roleRepository.save(obj);
  }

}