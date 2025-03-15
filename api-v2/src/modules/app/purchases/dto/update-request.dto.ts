import { PartialType } from "@nestjs/swagger";
import { CreatePurchaseRequestDto } from "./create-request.dto";

export class UpdatePurchaseRequestDto extends PartialType(CreatePurchaseRequestDto) {}