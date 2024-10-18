import { PartialType } from "@nestjs/swagger";
import { CreateProductPrice2Dto } from "./create-product-price2.dto";

export class UpdateProductPrice2Dto extends PartialType(CreateProductPrice2Dto) {}