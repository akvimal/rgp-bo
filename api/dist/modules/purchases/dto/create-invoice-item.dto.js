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
exports.CreatePurchaseInvoiceItemDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class CreatePurchaseInvoiceItemDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'invoice id', example: 0 }),
    __metadata("design:type", Number)
], CreatePurchaseInvoiceItemDto.prototype, "invoiceid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'product id', example: 0 }),
    __metadata("design:type", Number)
], CreatePurchaseInvoiceItemDto.prototype, "productid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'batch', example: '' }),
    __metadata("design:type", String)
], CreatePurchaseInvoiceItemDto.prototype, "batch", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'exp date', example: '' }),
    __metadata("design:type", String)
], CreatePurchaseInvoiceItemDto.prototype, "expdate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'ptr cost', example: 0 }),
    __metadata("design:type", Number)
], CreatePurchaseInvoiceItemDto.prototype, "ptrcost", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'mrp cost', example: 0 }),
    __metadata("design:type", Number)
], CreatePurchaseInvoiceItemDto.prototype, "mrpcost", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'tax percent', example: 0 }),
    __metadata("design:type", Number)
], CreatePurchaseInvoiceItemDto.prototype, "taxpcnt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'sale price', example: 0 }),
    __metadata("design:type", Number)
], CreatePurchaseInvoiceItemDto.prototype, "saleprice", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'quantity', example: 0 }),
    __metadata("design:type", Number)
], CreatePurchaseInvoiceItemDto.prototype, "qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'total', example: 0 }),
    __metadata("design:type", Number)
], CreatePurchaseInvoiceItemDto.prototype, "total", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'comments', example: '' }),
    __metadata("design:type", String)
], CreatePurchaseInvoiceItemDto.prototype, "comments", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'status', example: '' }),
    __metadata("design:type", String)
], CreatePurchaseInvoiceItemDto.prototype, "status", void 0);
exports.CreatePurchaseInvoiceItemDto = CreatePurchaseInvoiceItemDto;
//# sourceMappingURL=create-invoice-item.dto.js.map