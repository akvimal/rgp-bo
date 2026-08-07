import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Business } from "src/entities/business.entity";

@Injectable()
export class BusinessService {
  constructor(@InjectRepository(Business) private readonly businessRepository: Repository<Business>) {}

  findAll() {
    return this.businessRepository.createQueryBuilder("business")
      .where("business.active = true")
      .andWhere("business.archive = false")
      .orderBy("business.name", "ASC")
      .getMany();
  }

  async create(body: any, userid: any) {
    const payload = {
      name: body.name,
      isActive: body.isActive !== false,
      isArchived: false,
    };
    return this.businessRepository.save(payload);
  }

  async update(id: number, body: any) {
    const current = await this.businessRepository.findOne({ where: { id } });
    if (!current) {
      throw new Error("Business not found");
    }
    await this.businessRepository.update(id, {
      name: body.name,
      isActive: body.isActive === undefined ? current.isActive : !!body.isActive,
      isArchived: body.isArchived === undefined ? current.isArchived : !!body.isArchived,
    });
    return this.businessRepository.findOne({ where: { id } });
  }

  async remove(id: number) {
    await this.businessRepository.update(id, {
      isActive: false,
      isArchived: true,
    });
    return { success: true };
  }
}
