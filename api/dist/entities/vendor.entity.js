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
exports.Vendor = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
const purchase_invoice_entity_1 = require("./purchase-invoice.entity");
let Vendor = class Vendor extends base_entity_1.BaseEntity {
};
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: "integer", name: "id" }),
    __metadata("design:type", Number)
], Vendor.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "business_name", unique: true, length: 40 }),
    __metadata("design:type", String)
], Vendor.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "contact_name", length: 40 }),
    __metadata("design:type", String)
], Vendor.prototype, "contactname", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "contact_phone", length: 40 }),
    __metadata("design:type", String)
], Vendor.prototype, "contactphone", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "address", length: 200 }),
    __metadata("design:type", String)
], Vendor.prototype, "address", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "gstn", length: 40 }),
    __metadata("design:type", String)
], Vendor.prototype, "gstn", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "comments", length: 400 }),
    __metadata("design:type", String)
], Vendor.prototype, "comments", void 0);
__decorate([
    (0, typeorm_1.Column)("json", { name: "more_props", nullable: true }),
    __metadata("design:type", Object)
], Vendor.prototype, "props", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => purchase_invoice_entity_1.PurchaseInvoice, (purchaseInvoice) => purchaseInvoice.vendor),
    __metadata("design:type", Array)
], Vendor.prototype, "purchaseInvoices", void 0);
Vendor = __decorate([
    (0, typeorm_1.Index)("vendor_pk", ["id"], { unique: true }),
    (0, typeorm_1.Index)("vendor_un", ["name"], { unique: true }),
    (0, typeorm_1.Entity)("vendor", { schema: "pharma4" })
], Vendor);
exports.Vendor = Vendor;
//# sourceMappingURL=vendor.entity.js.map