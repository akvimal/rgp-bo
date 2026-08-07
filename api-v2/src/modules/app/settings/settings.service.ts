import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Setting } from "src/entities/setting.entity";
import { Repository } from "typeorm";
import { CreateSettingDto } from "./dto/create-setting.dto";

@Injectable()
export class SettingsService {
    constructor(@InjectRepository(Setting) private readonly repository: Repository<Setting>) {}

    create(dto: CreateSettingDto, userid: number) {
        return this.repository.save({
            ...dto,
            createdby: userid,
            updatedby: userid,
        });
    }

    findAll(query: any) {
        const qb = this.repository.createQueryBuilder('st')
            .where('st.isActive = :flag', { flag: true })
            .andWhere('st.isArchived = :archived', { archived: false });

        if(query.category){
            qb.andWhere('st.category = :category', { category: query.category });
        }
        if(query.key){
            qb.andWhere('st.key = :key', { key: query.key });
        }
        return qb.orderBy('st.category', 'ASC').addOrderBy('st.key', 'ASC').getMany();
    }

    findById(id: number) {
        return this.repository.findOne({ where: { id } });
    }

    update(id: number, values: any, userid: number) {
        return this.repository.save({
            id,
            ...values,
            updatedby: userid,
        });
    }

    remove(id: number, userid: number) {
        return this.repository.update(id, { isActive: false, updatedby: userid });
    }
}
