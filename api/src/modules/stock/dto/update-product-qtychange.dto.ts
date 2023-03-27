import { PartialType } from "@nestjs/swagger";
import { CreateProductQtyChangeDto } from "./create-product-qtychange.dto";

export class UpdateProductQtyChangeDto extends PartialType(CreateProductQtyChangeDto) {}