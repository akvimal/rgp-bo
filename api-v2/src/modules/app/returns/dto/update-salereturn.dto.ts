import { PartialType } from "@nestjs/swagger";
import { CreateSaleReturnDto } from "./create-salereturn.dto";

export class UpdateSaleReturnItemDto extends PartialType(CreateSaleReturnDto) {}