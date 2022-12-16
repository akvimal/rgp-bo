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
exports.AppUser = void 0;
const class_transformer_1 = require("class-transformer");
const typeorm_1 = require("typeorm");
const approle_entity_1 = require("./approle.entity");
const base_entity_1 = require("./base.entity");
const sale_entity_1 = require("./sale.entity");
let AppUser = class AppUser extends base_entity_1.BaseEntity {
};
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: "integer", name: "id" }),
    __metadata("design:type", Number)
], AppUser.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "role_id" }),
    __metadata("design:type", Number)
], AppUser.prototype, "roleid", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "email", length: 40 }),
    __metadata("design:type", String)
], AppUser.prototype, "email", void 0);
__decorate([
    (0, class_transformer_1.Exclude)(),
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], AppUser.prototype, "password", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "phone", nullable: true }),
    __metadata("design:type", String)
], AppUser.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "location", nullable: true, length: 80 }),
    __metadata("design:type", String)
], AppUser.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "full_name", length: 40 }),
    __metadata("design:type", String)
], AppUser.prototype, "fullname", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: "last_login", type: 'timestamp', nullable: true, default: null }),
    __metadata("design:type", Date)
], AppUser.prototype, "lastlogin", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => approle_entity_1.AppRole, (appRole) => appRole.appUsers),
    (0, typeorm_1.JoinColumn)([{ name: "role_id", referencedColumnName: "id" }]),
    __metadata("design:type", approle_entity_1.AppRole)
], AppUser.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => sale_entity_1.Sale, (sale) => sale.created),
    __metadata("design:type", Array)
], AppUser.prototype, "sales", void 0);
AppUser = __decorate([
    (0, typeorm_1.Index)("app_user_un", ["email"], { unique: true }),
    (0, typeorm_1.Index)("app_user_pk", ["id"], { unique: true }),
    (0, typeorm_1.Entity)("app_user", { schema: "pharma4" })
], AppUser);
exports.AppUser = AppUser;
//# sourceMappingURL=AppUser.entity.js.map