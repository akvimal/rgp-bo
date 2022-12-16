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
exports.PurchaseInvoiceController = void 0;
const invoice_service_1 = require("./invoice.service");
const swagger_1 = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const create_invoice_dto_1 = require("./dto/create-invoice.dto");
const passport_1 = require("@nestjs/passport");
const update_invoices_dto_1 = require("./dto/update-invoices.dto");
const user_decorator_1 = require("../../core/decorator/user.decorator");
let PurchaseInvoiceController = class PurchaseInvoiceController {
    constructor(purchaseInvoiceService) {
        this.purchaseInvoiceService = purchaseInvoiceService;
    }
    async findAll() {
        return this.purchaseInvoiceService.findAll();
    }
    async findById(id) {
        return this.purchaseInvoiceService.findById(id);
    }
    async create(dto, currentUser) {
        if (dto.id)
            return this.purchaseInvoiceService.update([dto.id], dto, currentUser.id);
        else
            return this.purchaseInvoiceService.create(dto, currentUser.id);
    }
    updateItems(input, currentUser) {
        return this.purchaseInvoiceService.update(input.ids, input.values, currentUser.id);
    }
    remove(id, currentUser) {
        return this.purchaseInvoiceService.update([id], { isActive: false }, currentUser.id);
    }
};
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PurchaseInvoiceController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PurchaseInvoiceController.prototype, "findById", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_invoice_dto_1.CreatePurchaseInvoiceDto, Object]),
    __metadata("design:returntype", Promise)
], PurchaseInvoiceController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_invoices_dto_1.UpdateInvoicesDto, Object]),
    __metadata("design:returntype", void 0)
], PurchaseInvoiceController.prototype, "updateItems", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PurchaseInvoiceController.prototype, "remove", null);
PurchaseInvoiceController = __decorate([
    (0, swagger_1.ApiTags)('PurchaseInvoices'),
    (0, common_1.Controller)('purchases'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    __metadata("design:paramtypes", [invoice_service_1.PurchaseInvoiceService])
], PurchaseInvoiceController);
exports.PurchaseInvoiceController = PurchaseInvoiceController;
//# sourceMappingURL=invoice.controller.js.map