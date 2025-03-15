import { PartialType } from "@nestjs/swagger";
import { CreateSaleDeliveryDto } from "./create-saledelivery.dto";

export class UpdateSaleDeliveryDto extends PartialType(CreateSaleDeliveryDto) {}