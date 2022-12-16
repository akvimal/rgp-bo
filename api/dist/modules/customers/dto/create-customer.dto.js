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
exports.CreateCustomerDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class CreateCustomerDto {
}
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'name', example: '' }),
    __metadata("design:type", String)
], CreateCustomerDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'mobile', example: '' }),
    __metadata("design:type", String)
], CreateCustomerDto.prototype, "mobile", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'email', example: '' }),
    __metadata("design:type", String)
], CreateCustomerDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'location', example: '' }),
    __metadata("design:type", String)
], CreateCustomerDto.prototype, "location", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'address', example: '' }),
    __metadata("design:type", String)
], CreateCustomerDto.prototype, "address", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'city', example: '' }),
    __metadata("design:type", String)
], CreateCustomerDto.prototype, "city", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'state', example: '' }),
    __metadata("design:type", String)
], CreateCustomerDto.prototype, "state", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'pincode', example: '' }),
    __metadata("design:type", String)
], CreateCustomerDto.prototype, "pincode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'source type', example: '' }),
    __metadata("design:type", String)
], CreateCustomerDto.prototype, "srctype", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'source desc', example: '' }),
    __metadata("design:type", String)
], CreateCustomerDto.prototype, "srcdesc", void 0);
exports.CreateCustomerDto = CreateCustomerDto;
//# sourceMappingURL=create-customer.dto.js.map