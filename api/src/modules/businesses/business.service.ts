import { Injectable } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { Business } from "../../entities/business.entity";
import { EntityManager, Repository } from "typeorm";

@Injectable()
export class BusinessService {

    constructor(@InjectEntityManager() private manager: EntityManager,
        @InjectRepository(Business) private readonly businessRepository: Repository<Business>){}
    
}