"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseInvoiceModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const product_entity_1 = require("../../entities/product.entity");
const purchase_invoice_item_entity_1 = require("../../entities/purchase-invoice-item.entity");
const purchase_invoice_entity_1 = require("../../entities/purchase-invoice.entity");
const invoice_controller_1 = require("./invoice.controller");
const invoice_service_1 = require("./invoice.service");
const items_controller_1 = require("./items.controller");
let PurchaseInvoiceModule = class PurchaseInvoiceModule {
};
PurchaseInvoiceModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([purchase_invoice_entity_1.PurchaseInvoice, purchase_invoice_item_entity_1.PurchaseInvoiceItem, product_entity_1.Product])],
        controllers: [invoice_controller_1.PurchaseInvoiceController, items_controller_1.PurchaseItemController],
        providers: [invoice_service_1.PurchaseInvoiceService],
        exports: [invoice_service_1.PurchaseInvoiceService],
    })
], PurchaseInvoiceModule);
exports.PurchaseInvoiceModule = PurchaseInvoiceModule;
//# sourceMappingURL=invoice.module.js.map