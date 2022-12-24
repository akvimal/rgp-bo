import { Injectable } from "@nestjs/common";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";

@Injectable()
export class StockService {

    constructor(@InjectEntityManager() private manager: EntityManager){}
    
    async findAll(){
        return await this.manager.query(`
        select * from stock_view where (life_left is null or life_left >= 0)`);
    }    
    async findByItem(id){
        return await this.manager.query(`
        select * from stock_view where id = ${id}`);
    }    
    
    // async findByCriteria(criteria){
    //     let query = `select * from stock_view`;
    //     if(criteria) {
    //         query += `where `
    //         query += criteria.expired && `life_left > 0`
    //     }
    //     return await this.manager.query(query);
    // }
}