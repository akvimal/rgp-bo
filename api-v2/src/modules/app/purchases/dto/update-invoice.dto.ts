import { PartialType } from "@nestjs/swagger";
import { CreatePurchaseInvoiceDto } from "./create-invoice.dto";

export class UpdateInvoiceDto extends PartialType(CreatePurchaseInvoiceDto) {}