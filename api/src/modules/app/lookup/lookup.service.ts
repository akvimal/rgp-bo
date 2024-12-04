import { Injectable } from "@nestjs/common";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";

@Injectable()
export class LookupService {

  constructor(@InjectEntityManager() private manager: EntityManager) { }

  async find(entity:string, property:string, criteria:string){
    let sql = `select distinct ${property} from ${entity} 
    where ${property} ilike '${criteria.replace('\'','\'\'')}%' 
    order by ${property} asc`;
    
    return await this.manager.query(sql);
  }
}