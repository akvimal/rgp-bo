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
exports.Product = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
const purchase_invoice_item_entity_1 = require("./purchase-invoice-item.entity");
let Product = class Product extends base_entity_1.BaseEntity {
};
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: "integer", name: "id" }),
    __metadata("design:type", Number)
], Product.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "title", unique: true, length: 40 }),
    __metadata("design:type", String)
], Product.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "product_code", length: 40 }),
    __metadata("design:type", String)
], Product.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "hsn_code", length: 40 }),
    __metadata("design:type", String)
], Product.prototype, "hsn", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "mfr", length: 40 }),
    __metadata("design:type", String)
], Product.prototype, "mfr", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "brand", length: 40 }),
    __metadata("design:type", String)
], Product.prototype, "brand", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "category", length: 40 }),
    __metadata("design:type", String)
], Product.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "description", length: 400 }),
    __metadata("design:type", String)
], Product.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)("json", { name: "more_props", nullable: true }),
    __metadata("design:type", Object)
], Product.prototype, "props", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => purchase_invoice_item_entity_1.PurchaseInvoiceItem, (purchaseInvoiceItem) => purchaseInvoiceItem.product),
    __metadata("design:type", Array)
], Product.prototype, "purchaseInvoiceItems", void 0);
Product = __decorate([
    (0, typeorm_1.Index)("product_pk", ["id"], { unique: true }),
    (0, typeorm_1.Index)("product_un", ["title"], { unique: true }),
    (0, typeorm_1.Entity)("product", { schema: "pharma4" })
], Product);
exports.Product = Product;
//# sourceMappingURL=product.entity.js.map