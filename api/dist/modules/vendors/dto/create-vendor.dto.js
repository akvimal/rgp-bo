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
exports.CreateVendorDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateVendorDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'business name', example: '' }),
    __metadata("design:type", String)
], CreateVendorDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'contact name', example: '' }),
    __metadata("design:type", String)
], CreateVendorDto.prototype, "contactname", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'contact phone', example: '' }),
    __metadata("design:type", String)
], CreateVendorDto.prototype, "contactphone", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'address', example: '' }),
    __metadata("design:type", String)
], CreateVendorDto.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'gstn', example: '' }),
    __metadata("design:type", String)
], CreateVendorDto.prototype, "gstn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'comments', example: '' }),
    __metadata("design:type", String)
], CreateVendorDto.prototype, "comments", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'props', example: '{}' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateVendorDto.prototype, "props", void 0);
exports.CreateVendorDto = CreateVendorDto;
//# sourceMappingURL=create-vendor.dto.js.map