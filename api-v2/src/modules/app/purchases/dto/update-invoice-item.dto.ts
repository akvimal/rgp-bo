import { PartialType } from "@nestjs/swagger";
import { CreatePurchaseInvoiceItemDto } from "./create-invoice-item.dto";

export class UpdatePurchaseInvoiceItemDto extends PartialType(CreatePurchaseInvoiceItemDto) {}