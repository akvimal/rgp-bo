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
exports.AppRole = void 0;
const typeorm_1 = require("typeorm");
const AppUser_entity_1 = require("./AppUser.entity");
const base_entity_1 = require("./base.entity");
let AppRole = class AppRole extends base_entity_1.BaseEntity {
};
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: "integer", name: "id" }),
    __metadata("design:type", Number)
], AppRole.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "name", length: 40 }),
    __metadata("design:type", String)
], AppRole.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)("json", { name: "permissions", nullable: true }),
    __metadata("design:type", Object)
], AppRole.prototype, "permissions", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'locked', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], AppRole.prototype, "isLocked", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => AppUser_entity_1.AppUser, (appUser) => appUser.role),
    __metadata("design:type", Array)
], AppRole.prototype, "appUsers", void 0);
AppRole = __decorate([
    (0, typeorm_1.Index)("app_role_un", ["name"], { unique: true }),
    (0, typeorm_1.Index)("app_role_pk", ["id"], { unique: true }),
    (0, typeorm_1.Entity)("app_role", { schema: "pharma4" })
], AppRole);
exports.AppRole = AppRole;
//# sourceMappingURL=approle.entity.js.map