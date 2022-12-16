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
exports.Customer = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
const sale_entity_1 = require("./sale.entity");
let Customer = class Customer extends base_entity_1.BaseEntity {
};
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: "integer", name: "id" }),
    __metadata("design:type", Number)
], Customer.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "name", nullable: true, unique: true }),
    __metadata("design:type", String)
], Customer.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "mobile", nullable: true, unique: true }),
    __metadata("design:type", String)
], Customer.prototype, "mobile", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "email", nullable: true, unique: true }),
    __metadata("design:type", String)
], Customer.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "location", nullable: true }),
    __metadata("design:type", String)
], Customer.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "address", nullable: true }),
    __metadata("design:type", String)
], Customer.prototype, "address", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "city", nullable: true }),
    __metadata("design:type", String)
], Customer.prototype, "city", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "state", nullable: true }),
    __metadata("design:type", String)
], Customer.prototype, "state", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "pincode", nullable: true }),
    __metadata("design:type", String)
], Customer.prototype, "pincode", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "source_type", nullable: true }),
    __metadata("design:type", String)
], Customer.prototype, "srctype", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "source_desc", nullable: true }),
    __metadata("design:type", String)
], Customer.prototype, "srcdesc", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => sale_entity_1.Sale, (sale) => sale.customer),
    __metadata("design:type", Array)
], Customer.prototype, "sales", void 0);
Customer = __decorate([
    (0, typeorm_1.Index)("customer_pk", ["id"], { unique: true }),
    (0, typeorm_1.Index)("customer_un", ["mobile", "name"], { unique: true }),
    (0, typeorm_1.Entity)("customer", { schema: "pharma4" })
], Customer);
exports.Customer = Customer;
//# sourceMappingURL=customer.entity.js.map