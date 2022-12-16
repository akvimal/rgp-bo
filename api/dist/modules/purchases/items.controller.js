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
exports.PurchaseItemController = void 0;
const invoice_service_1 = require("./invoice.service");
const swagger_1 = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const create_invoice_item_dto_1 = require("./dto/create-invoice-item.dto");
const passport_1 = require("@nestjs/passport");
const update_invoice_items_dto_1 = require("./dto/update-invoice-items.dto");
const user_decorator_1 = require("../../core/decorator/user.decorator");
let PurchaseItemController = class PurchaseItemController {
    constructor(purchaseInvoiceService) {
        this.purchaseInvoiceService = purchaseInvoiceService;
    }
    async findAllItems(status) {
        return this.purchaseInvoiceService.findAllItems({ status });
    }
    async findItemById(id) {
        return this.purchaseInvoiceService.findItemById(id);
    }
    async createItem(createPurchaseInvoiceItemDto, currentUser) {
        const item = await this.purchaseInvoiceService.createItem(createPurchaseInvoiceItemDto, currentUser.id);
        await this.purchaseInvoiceService.findAllItemsByInvoice(item.invoiceid).then(async (items) => {
            let total = 0;
            items.forEach(item => {
                total += item.total && +item.total;
            });
            await this.purchaseInvoiceService.update([item.invoiceid], { total }, currentUser.id);
        });
    }
    updateItems(input, currentUser) {
        return this.purchaseInvoiceService.updateItems(input.ids, input.values, currentUser.id);
    }
    async remove(input, currentUser) {
        await this.purchaseInvoiceService.removeItems(input.ids).then(async (data) => {
            await this.purchaseInvoiceService.findAllItemsByInvoice(input.invoiceid).then(async (items) => {
                let total = 0;
                items.forEach(item => {
                    total += item.total && +item.total;
                });
                await this.purchaseInvoiceService.update([input.invoiceid], { total }, currentUser.id);
            });
        });
    }
};
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PurchaseItemController.prototype, "findAllItems", null);
__decorate([
    (0, common_1.Get)('/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PurchaseItemController.prototype, "findItemById", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_invoice_item_dto_1.CreatePurchaseInvoiceItemDto, Object]),
    __metadata("design:returntype", Promise)
], PurchaseItemController.prototype, "createItem", null);
__decorate([
    (0, common_1.Put)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_invoice_items_dto_1.UpdateInvoiceItemsDto, Object]),
    __metadata("design:returntype", void 0)
], PurchaseItemController.prototype, "updateItems", null);
__decorate([
    (0, common_1.Delete)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PurchaseItemController.prototype, "remove", null);
PurchaseItemController = __decorate([
    (0, swagger_1.ApiTags)('PurchaseItems'),
    (0, common_1.Controller)('purchaseitems'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    __metadata("design:paramtypes", [invoice_service_1.PurchaseInvoiceService])
], PurchaseItemController);
exports.PurchaseItemController = PurchaseItemController;
//# sourceMappingURL=items.controller.js.map