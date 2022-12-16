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
exports.Sale = void 0;
const typeorm_1 = require("typeorm");
const AppUser_entity_1 = require("./AppUser.entity");
const base_entity_1 = require("./base.entity");
const customer_entity_1 = require("./customer.entity");
const sale_item_entity_1 = require("./sale-item.entity");
let Sale = class Sale extends base_entity_1.BaseEntity {
};
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: "integer", name: "id" }),
    __metadata("design:type", Number)
], Sale.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp without time zone", { name: "bill_date" }),
    __metadata("design:type", Date)
], Sale.prototype, "billdate", void 0);
__decorate([
    (0, typeorm_1.Column)("integer", { name: "customer_id" }),
    __metadata("design:type", Number)
], Sale.prototype, "customerid", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "status", nullable: true }),
    __metadata("design:type", String)
], Sale.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "paymode", nullable: true }),
    __metadata("design:type", String)
], Sale.prototype, "paymode", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "payrefno", nullable: true }),
    __metadata("design:type", String)
], Sale.prototype, "payrefno", void 0);
__decorate([
    (0, typeorm_1.Column)("double precision", { name: "total", precision: 53 }),
    __metadata("design:type", Number)
], Sale.prototype, "total", void 0);
__decorate([
    (0, typeorm_1.Column)("json", { name: "more_props", nullable: true }),
    __metadata("design:type", Object)
], Sale.prototype, "props", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => customer_entity_1.Customer, (customer) => customer.sales),
    (0, typeorm_1.JoinColumn)([{ name: "customer_id", referencedColumnName: "id" }]),
    __metadata("design:type", customer_entity_1.Customer)
], Sale.prototype, "customer", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => AppUser_entity_1.AppUser, (user) => user.sales),
    (0, typeorm_1.JoinColumn)([{ name: "created_by", referencedColumnName: "id" }]),
    __metadata("design:type", AppUser_entity_1.AppUser)
], Sale.prototype, "created", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => sale_item_entity_1.SaleItem, (item) => item.sale),
    __metadata("design:type", Array)
], Sale.prototype, "items", void 0);
Sale = __decorate([
    (0, typeorm_1.Index)("sale_pk", ["id"], { unique: true }),
    (0, typeorm_1.Entity)("sale", { schema: "pharma4" })
], Sale);
exports.Sale = Sale;
//# sourceMappingURL=sale.entity.js.map