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
exports.CreateSaleItemDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class CreateSaleItemDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'sale id', example: 0 }),
    __metadata("design:type", Number)
], CreateSaleItemDto.prototype, "saleid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'purchase item id', example: 0 }),
    __metadata("design:type", Number)
], CreateSaleItemDto.prototype, "itemid", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'price', example: 0 }),
    __metadata("design:type", Number)
], CreateSaleItemDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'quantity', example: 0 }),
    __metadata("design:type", Number)
], CreateSaleItemDto.prototype, "qty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'status', example: '' }),
    __metadata("design:type", String)
], CreateSaleItemDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'comments', example: '' }),
    __metadata("design:type", String)
], CreateSaleItemDto.prototype, "comments", void 0);
exports.CreateSaleItemDto = CreateSaleItemDto;
//# sourceMappingURL=create-saleitem.dto.js.map