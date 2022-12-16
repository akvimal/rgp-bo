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
exports.PurchaseInvoice = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
const purchase_invoice_item_entity_1 = require("./purchase-invoice-item.entity");
const vendor_entity_1 = require("./vendor.entity");
let PurchaseInvoice = class PurchaseInvoice extends base_entity_1.BaseEntity {
};
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: "integer", name: "id" }),
    __metadata("design:type", Number)
], PurchaseInvoice.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "invoice_no", unique: true }),
    __metadata("design:type", String)
], PurchaseInvoice.prototype, "invoiceno", void 0);
__decorate([
    (0, typeorm_1.Column)("date", { name: "invoice_date" }),
    __metadata("design:type", String)
], PurchaseInvoice.prototype, "invoicedate", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "status" }),
    __metadata("design:type", String)
], PurchaseInvoice.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "grn" }),
    __metadata("design:type", String)
], PurchaseInvoice.prototype, "grn", void 0);
__decorate([
    (0, typeorm_1.Column)("double precision", { name: "total", precision: 53 }),
    __metadata("design:type", Number)
], PurchaseInvoice.prototype, "total", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "comments" }),
    __metadata("design:type", String)
], PurchaseInvoice.prototype, "comments", void 0);
__decorate([
    (0, typeorm_1.Column)("integer", { name: "vendor_id", unique: true }),
    __metadata("design:type", Number)
], PurchaseInvoice.prototype, "vendorid", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "purchase_order_id" }),
    __metadata("design:type", String)
], PurchaseInvoice.prototype, "purchaseorderid", void 0);
__decorate([
    (0, typeorm_1.Column)("date", { name: "pay_date" }),
    __metadata("design:type", String)
], PurchaseInvoice.prototype, "paydate", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "pay_mode" }),
    __metadata("design:type", String)
], PurchaseInvoice.prototype, "paymode", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "pay_refno" }),
    __metadata("design:type", String)
], PurchaseInvoice.prototype, "payrefno", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "pay_comments" }),
    __metadata("design:type", String)
], PurchaseInvoice.prototype, "paycomments", void 0);
__decorate([
    (0, typeorm_1.Column)("double precision", { name: "pay_amount", precision: 53 }),
    __metadata("design:type", Number)
], PurchaseInvoice.prototype, "payamount", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => vendor_entity_1.Vendor, (vendor) => vendor.purchaseInvoices),
    (0, typeorm_1.JoinColumn)([{ name: "vendor_id", referencedColumnName: "id" }]),
    __metadata("design:type", vendor_entity_1.Vendor)
], PurchaseInvoice.prototype, "vendor", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => purchase_invoice_item_entity_1.PurchaseInvoiceItem, (purchaseInvoiceItem) => purchaseInvoiceItem.invoice, { cascade: true }),
    __metadata("design:type", Array)
], PurchaseInvoice.prototype, "items", void 0);
PurchaseInvoice = __decorate([
    (0, typeorm_1.Index)("purchase_invoice_pk", ["id"], { unique: true }),
    (0, typeorm_1.Index)("purchase_invoice_un", ["invoiceno", "vendorid"], { unique: true }),
    (0, typeorm_1.Entity)("purchase_invoice", { schema: "pharma4" })
], PurchaseInvoice);
exports.PurchaseInvoice = PurchaseInvoice;
//# sourceMappingURL=purchase-invoice.entity.js.map