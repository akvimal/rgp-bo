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
exports.ProductController = void 0;
const product_service_1 = require("./product.service");
const swagger_1 = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const create_product_dto_1 = require("./dto/create-product.dto");
const passport_1 = require("@nestjs/passport");
const user_decorator_1 = require("../../core/decorator/user.decorator");
const update_product_dto_1 = require("./dto/update-product.dto");
const create_product_price_dto_1 = require("./dto/create-product-price.dto");
const invoice_service_1 = require("../purchases/invoice.service");
let ProductController = class ProductController {
    constructor(productService, invoiceService) {
        this.productService = productService;
        this.invoiceService = invoiceService;
    }
    async create(createDto, currentUser) {
        return this.productService.create(createDto, currentUser.id);
    }
    async createPrice(createDto, currentUser) {
        const updated = await this.invoiceService.updateItems([createDto.itemid], { saleprice: createDto.price }, currentUser.id);
        return this.productService.createPrice(createDto, currentUser.id);
    }
    update(id, updateDto, currentUser) {
        return this.productService.update(id, updateDto, currentUser.id);
    }
    findAll(query, currentUser) {
        return this.productService.findAll(query, currentUser);
    }
    async findOne(id) {
        return this.productService.findById(id);
    }
    remove(id, currentUser) {
        return this.productService.update(id, { isActive: false }, currentUser.id);
    }
};
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_product_dto_1.CreateProductDto, Object]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('/price'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_product_price_dto_1.CreateProductPriceDto, Object]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "createPrice", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_product_dto_1.UpdateProductDto, Object]),
    __metadata("design:returntype", void 0)
], ProductController.prototype, "update", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ProductController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ProductController.prototype, "findOne", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ProductController.prototype, "remove", null);
ProductController = __decorate([
    (0, swagger_1.ApiTags)('Products'),
    (0, common_1.Controller)('products'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    __metadata("design:paramtypes", [product_service_1.ProductService, invoice_service_1.PurchaseInvoiceService])
], ProductController);
exports.ProductController = ProductController;
//# sourceMappingURL=product.controller.js.map