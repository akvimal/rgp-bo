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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const approle_entity_1 = require("../../../entities/approle.entity");
let RoleService = class RoleService {
    constructor(roleRepository) {
        this.roleRepository = roleRepository;
    }
    async create(createRoleDto, userid) {
        return this.roleRepository.save(Object.assign(Object.assign({}, createRoleDto), { createdby: userid }));
    }
    findAll() {
        return this.roleRepository.createQueryBuilder('r')
            .where(`r.isLocked = :flag and r.isArchived = false`, { flag: false }).getMany();
    }
    findById(id) {
        return this.roleRepository.findOne(id);
    }
    update(id, updateRoleDto) {
        return this.roleRepository.update(id, updateRoleDto);
    }
    async delete(id, currentUser) {
        const obj = await this.roleRepository.findOne(id);
        if (obj) {
            obj.isActive = false;
            obj.isArchived = true;
            obj.updatedby = currentUser.id;
        }
        return this.roleRepository.save(obj);
    }
};
RoleService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(approle_entity_1.AppRole)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], RoleService);
exports.RoleService = RoleService;
//# sourceMappingURL=role.service.js.map