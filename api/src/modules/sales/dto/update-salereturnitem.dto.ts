import { PartialType } from "@nestjs/swagger";
import { CreateSaleReturnItemDto } from "./create-salereturnitem.dto";

export class UpdateSaleReturnItemDto extends PartialType(CreateSaleReturnItemDto) {}