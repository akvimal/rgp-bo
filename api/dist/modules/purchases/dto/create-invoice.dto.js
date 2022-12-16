"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePurchaseInvoiceDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class CreatePurchaseInvoiceDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ID', example: '' }),
    __metadata("design:type", Number)
], CreatePurchaseInvoiceDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'invoice no', example: '' }),
    __metadata("design:type", String)
], CreatePurchaseInvoiceDto.prototype, "invoiceno", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'invoice date', example: '' }),
    __metadata("design:type", String)
], CreatePurchaseInvoiceDto.prototype, "invoicedate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'status', example: '' }),
    __metadata("design:type", String)
], CreatePurchaseInvoiceDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'grn', example: '' }),
    __metadata("design:type", String)
], CreatePurchaseInvoiceDto.prototype, "grn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'total', example: 0 }),
    __metadata("design:type", Number)
], CreatePurchaseInvoiceDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'vendor id', example: 0 }),
    __metadata("design:type", Number)
], CreatePurchaseInvoiceDto.prototype, "vendorid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'purchase order id', example: '' }),
    __metadata("design:type", String)
], CreatePurchaseInvoiceDto.prototype, "purchaseorderid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'items', example: [] }),
    __metadata("design:type", Array)
], CreatePurchaseInvoiceDto.prototype, "items", void 0);
exports.CreatePurchaseInvoiceDto = CreatePurchaseInvoiceDto;
//# sourceMappingURL=create-invoice.dto.js.map