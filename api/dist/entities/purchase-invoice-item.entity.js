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
exports.PurchaseInvoiceItem = void 0;
const typeorm_1 = require("typeorm");
const purchase_invoice_entity_1 = require("./purchase-invoice.entity");
const product_entity_1 = require("./product.entity");
const base_entity_1 = require("./base.entity");
const sale_item_entity_1 = require("./sale-item.entity");
let PurchaseInvoiceItem = class PurchaseInvoiceItem extends base_entity_1.BaseEntity {
};
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: "integer", name: "id" }),
    __metadata("design:type", Number)
], PurchaseInvoiceItem.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)("integer", { name: "invoice_id", unique: true }),
    __metadata("design:type", Number)
], PurchaseInvoiceItem.prototype, "invoiceid", void 0);
__decorate([
    (0, typeorm_1.Column)("integer", { name: "product_id", unique: true }),
    __metadata("design:type", Number)
], PurchaseInvoiceItem.prototype, "productid", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "batch", nullable: true, unique: true }),
    __metadata("design:type", String)
], PurchaseInvoiceItem.prototype, "batch", void 0);
__decorate([
    (0, typeorm_1.Column)("date", { name: "exp_date", nullable: true }),
    __metadata("design:type", String)
], PurchaseInvoiceItem.prototype, "expdate", void 0);
__decorate([
    (0, typeorm_1.Column)("double precision", { name: "ptr_cost", precision: 53 }),
    __metadata("design:type", Number)
], PurchaseInvoiceItem.prototype, "ptrcost", void 0);
__decorate([
    (0, typeorm_1.Column)("double precision", { name: "mrp_cost", precision: 53 }),
    __metadata("design:type", Number)
], PurchaseInvoiceItem.prototype, "mrpcost", void 0);
__decorate([
    (0, typeorm_1.Column)("double precision", {
        name: "tax_pcnt",
        nullable: true,
        precision: 53,
    }),
    __metadata("design:type", Number)
], PurchaseInvoiceItem.prototype, "taxpcnt", void 0);
__decorate([
    (0, typeorm_1.Column)("double precision", {
        name: "sale_price",
        nullable: true,
        precision: 53,
    }),
    __metadata("design:type", Number)
], PurchaseInvoiceItem.prototype, "saleprice", void 0);
__decorate([
    (0, typeorm_1.Column)("integer", { name: "qty" }),
    __metadata("design:type", Number)
], PurchaseInvoiceItem.prototype, "qty", void 0);
__decorate([
    (0, typeorm_1.Column)("double precision", { name: "total", precision: 53 }),
    __metadata("design:type", Number)
], PurchaseInvoiceItem.prototype, "total", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "comments" }),
    __metadata("design:type", String)
], PurchaseInvoiceItem.prototype, "comments", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "status" }),
    __metadata("design:type", String)
], PurchaseInvoiceItem.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => purchase_invoice_entity_1.PurchaseInvoice, (purchaseInvoice) => purchaseInvoice.items),
    (0, typeorm_1.JoinColumn)([{ name: "invoice_id", referencedColumnName: "id" }]),
    __metadata("design:type", purchase_invoice_entity_1.PurchaseInvoice)
], PurchaseInvoiceItem.prototype, "invoice", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => product_entity_1.Product, (product) => product.purchaseInvoiceItems),
    (0, typeorm_1.JoinColumn)([{ name: "product_id", referencedColumnName: "id" }]),
    __metadata("design:type", product_entity_1.Product)
], PurchaseInvoiceItem.prototype, "product", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => sale_item_entity_1.SaleItem, (saleItem) => saleItem.purchaseitem),
    __metadata("design:type", Array)
], PurchaseInvoiceItem.prototype, "saleitems", void 0);
PurchaseInvoiceItem = __decorate([
    (0, typeorm_1.Index)("pur_invitem_un", ["batch", "invoiceid", "productid"], { unique: true }),
    (0, typeorm_1.Index)("pur_invitem_pk", ["id"], { unique: true }),
    (0, typeorm_1.Entity)("purchase_invoice_item", { schema: "pharma4" })
], PurchaseInvoiceItem);
exports.PurchaseInvoiceItem = PurchaseInvoiceItem;
//# sourceMappingURL=purchase-invoice-item.entity.js.map