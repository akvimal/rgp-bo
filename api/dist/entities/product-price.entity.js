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
exports.ProductPrice = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("./base.entity");
let ProductPrice = class ProductPrice extends base_entity_1.BaseEntity {
};
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: "integer", name: "id" }),
    __metadata("design:type", Number)
], ProductPrice.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)("integer", { name: "item_id", unique: true }),
    __metadata("design:type", Number)
], ProductPrice.prototype, "itemid", void 0);
__decorate([
    (0, typeorm_1.Column)("double precision", { name: "price", precision: 53 }),
    __metadata("design:type", Number)
], ProductPrice.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'eff_date', type: 'date', default: () => 'CURRENT_DATE' }),
    __metadata("design:type", Date)
], ProductPrice.prototype, "effdate", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "comments", nullable: true }),
    __metadata("design:type", String)
], ProductPrice.prototype, "comments", void 0);
ProductPrice = __decorate([
    (0, typeorm_1.Index)("product_price_pk", ["id"], { unique: true }),
    (0, typeorm_1.Index)("product_price_un", ["itemid"], { unique: true }),
    (0, typeorm_1.Entity)("product_price", { schema: "pharma4" })
], ProductPrice);
exports.ProductPrice = ProductPrice;
//# sourceMappingURL=product-price.entity.js.map