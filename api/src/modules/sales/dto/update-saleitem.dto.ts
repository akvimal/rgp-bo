import { PartialType } from "@nestjs/swagger";
import { CreateSaleItemDto } from "./create-saleitem.dto";

export class UpdateSaleItemDto extends PartialType(CreateSaleItemDto) {}