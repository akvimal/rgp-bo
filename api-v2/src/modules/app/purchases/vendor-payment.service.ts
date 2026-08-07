import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { VendorPayment } from "src/entities/vendor-payment.entity";
import { Repository } from "typeorm";

@Injectable()
export class VendorPaymentService {
    constructor(@InjectRepository(VendorPayment) private readonly paymentRepository: Repository<VendorPayment>) {}

    create(dto: any, userid: number) {
        return this.paymentRepository.save({
            ...dto,
            communicationstatus: dto.communicationstatus || 'Not Sent',
            communicatedat: dto.communicatedat ? new Date(dto.communicatedat) : null,
            acknowledgedat: dto.acknowledgedat ? new Date(dto.acknowledgedat) : null,
            createdby: userid,
            updatedby: userid,
        });
    }

    update(id: number, dto: any, userid: number) {
        return this.paymentRepository.update(id, {
            ...dto,
            communicatedat: dto.communicatedat ? new Date(dto.communicatedat) : null,
            acknowledgedat: dto.acknowledgedat ? new Date(dto.acknowledgedat) : null,
            updatedby: userid,
        });
    }

    findByInvoice(invoiceid: number) {
        return this.paymentRepository.find({
            where: { invoiceid, isActive: true, isArchived: false },
            order: { paydate: 'DESC', id: 'DESC' },
        });
    }
}
