import { PartialType } from "@nestjs/swagger";
import { CreatePurchaseOrderDto } from "./create-order.dto";

export class UpdatePurchaseOrderDto extends PartialType(CreatePurchaseOrderDto) {}