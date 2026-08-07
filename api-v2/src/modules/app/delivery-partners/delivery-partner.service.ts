import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DeliveryPartner } from "src/entities/delivery-partner.entity";
import { Repository } from "typeorm";
import { CreateDeliveryPartnerDto } from "./dto/create-delivery-partner.dto";

@Injectable()
export class DeliveryPartnerService {
    constructor(@InjectRepository(DeliveryPartner) private readonly partnerRepository: Repository<DeliveryPartner>) {}

    create(dto: CreateDeliveryPartnerDto, userid: number) {
        return this.partnerRepository.save({
            ...dto,
            createdby: userid,
            updatedby: userid,
        });
    }

    findAll() {
        return this.partnerRepository.find({
            where: { isActive: true, isArchived: false },
            order: { name: 'ASC' },
        });
    }

    findById(id: number) {
        return this.partnerRepository.findOne({ where: { id } });
    }

    update(id: number, values: any, userid: number) {
        return this.partnerRepository.update(id, { ...values, updatedby: userid });
    }

    remove(id: number, userid: number) {
        return this.partnerRepository.update(id, { isActive: false, updatedby: userid });
    }
}
