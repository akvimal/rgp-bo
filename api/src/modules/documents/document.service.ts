import { Injectable } from "@nestjs/common";
import { InjectEntityManager, InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { Document } from "src/entities/document.entity";
import { CreateDocumentDto } from "./dto/create-document.dto";

@Injectable()
export class DocumentService {

    constructor(@InjectRepository(Document) private readonly repository: Repository<Document>,
                @InjectEntityManager() private manager: EntityManager) { }

    async save(dto: CreateDocumentDto) {
        return this.repository.save(dto);
      }
    
      async findAll(){
        return this.repository.createQueryBuilder('c')
            .where('c.active = :flag', { flag: true }).getMany();
    }
    
    async filter(ids:number[]){
        return this.repository.createQueryBuilder('c')
            .where('c.active = :flag and c.id in (:...ids)', { flag: true, ids}).orderBy('c.created_on','DESC').getMany();
    }
    
    async findById(id:number) {
        return this.repository.findOne(id);
    }

}