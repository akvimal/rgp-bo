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
exports.SaleItem = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
const purchase_invoice_item_entity_1 = require("./purchase-invoice-item.entity");
const sale_entity_1 = require("./sale.entity");
let SaleItem = class SaleItem extends base_entity_1.BaseEntity {
};
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: "integer", name: "id" }),
    __metadata("design:type", Number)
], SaleItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)("integer", { name: "sale_id", unique: true }),
    __metadata("design:type", Number)
], SaleItem.prototype, "saleid", void 0);
__decorate([
    (0, typeorm_1.Column)("integer", { name: "purchase_item_id", unique: true }),
    __metadata("design:type", Number)
], SaleItem.prototype, "itemid", void 0);
__decorate([
    (0, typeorm_1.Column)("double precision", { name: "price", precision: 53 }),
    __metadata("design:type", Number)
], SaleItem.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)("integer", { name: "qty" }),
    __metadata("design:type", Number)
], SaleItem.prototype, "qty", void 0);
__decorate([
    (0, typeorm_1.Column)("double precision", { name: "total", precision: 53 }),
    __metadata("design:type", Number)
], SaleItem.prototype, "total", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "status", nullable: true }),
    __metadata("design:type", String)
], SaleItem.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "comments", nullable: true }),
    __metadata("design:type", String)
], SaleItem.prototype, "comments", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => purchase_invoice_item_entity_1.PurchaseInvoiceItem, (purchase) => purchase.saleitems),
    (0, typeorm_1.JoinColumn)([{ name: "purchase_item_id", referencedColumnName: "id" }]),
    __metadata("design:type", purchase_invoice_item_entity_1.PurchaseInvoiceItem)
], SaleItem.prototype, "purchaseitem", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => sale_entity_1.Sale, (sale) => sale.items),
    (0, typeorm_1.JoinColumn)([{ name: "sale_id", referencedColumnName: "id" }]),
    __metadata("design:type", sale_entity_1.Sale)
], SaleItem.prototype, "sale", void 0);
SaleItem = __decorate([
    (0, typeorm_1.Index)("sale_item_pk", ["id"], { unique: true }),
    (0, typeorm_1.Index)("sale_item_un", ["itemid", "saleid"], { unique: true }),
    (0, typeorm_1.Entity)("sale_item", { schema: "pharma4" })
], SaleItem);
exports.SaleItem = SaleItem;
//# sourceMappingURL=sale-item.entity.js.map