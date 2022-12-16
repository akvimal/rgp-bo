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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorController = void 0;
const vendor_service_1 = require("./vendor.service");
const swagger_1 = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const create_vendor_dto_1 = require("./dto/create-vendor.dto");
const passport_1 = require("@nestjs/passport");
const update_vendor_dto_1 = require("./dto/update-vendor.dto");
const user_decorator_1 = require("../../core/decorator/user.decorator");
let VendorController = class VendorController {
    constructor(vendorService) {
        this.vendorService = vendorService;
    }
    async create(createVendorDto) {
        return this.vendorService.create(createVendorDto);
    }
    update(id, updateDto, currentUser) {
        return this.vendorService.update(id, updateDto, currentUser.id);
    }
    async findAll() {
        return this.vendorService.findAll();
    }
    async findOne(id) {
        return this.vendorService.findById(id);
    }
    remove(id, currentUser) {
        return this.vendorService.update(id, { isActive: false }, currentUser.id);
    }
};
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_vendor_dto_1.CreateVendorDto]),
    __metadata("design:returntype", Promise)
], VendorController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_vendor_dto_1.UpdateVendorDto, Object]),
    __metadata("design:returntype", void 0)
], VendorController.prototype, "update", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], VendorController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VendorController.prototype, "findOne", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], VendorController.prototype, "remove", null);
VendorController = __decorate([
    (0, swagger_1.ApiTags)('Vendors'),
    (0, common_1.Controller)('vendors'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    __metadata("design:paramtypes", [vendor_service_1.VendorService])
], VendorController);
exports.VendorController = VendorController;
//# sourceMappingURL=vendor.controller.js.map