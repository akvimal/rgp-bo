import { PartialType } from '@nestjs/swagger';
import { CreateDeliveryPartnerDto } from './create-delivery-partner.dto';

export class UpdateDeliveryPartnerDto extends PartialType(CreateDeliveryPartnerDto) {}
