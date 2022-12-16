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
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const AppUser_entity_1 = require("../../../entities/AppUser.entity");
const typeorm_2 = require("typeorm");
const auth_helper_1 = require("../auth/auth.helper");
let UserService = class UserService {
    constructor(userRepository, helper) {
        this.userRepository = userRepository;
        this.helper = helper;
    }
    async create(createUserDto, userid) {
        return this.userRepository.save(Object.assign(Object.assign({}, createUserDto), { password: this.helper.encodePassword(createUserDto.password), isResetPwd: true, createdby: userid }));
    }
    findAll() {
        return this.userRepository.createQueryBuilder('u')
            .leftJoinAndSelect("u.role", "role")
            .where('u.isActive = true and u.isArchived = false and role.isLocked = false')
            .select(['u.id as id',
            'u.fullname as fullname', 'u.email as email', 'u.phone as phone',
            'u.location as location', 'role.name as role',])
            .getRawMany();
    }
    findAllByOrganization(orgId) {
        if (orgId === '0')
            return this.userRepository.find({ where: { orgid: null, isActive: true } });
        return this.userRepository.find({ where: { orgid: +orgId, isActive: true } });
    }
    findById(id) {
        return this.userRepository.findOne(id);
    }
    async findBasicDetails(id) {
        const data = await this.userRepository.createQueryBuilder('u')
            .leftJoinAndSelect("u.role", "role")
            .where('u.isActive = true and u.id = :id', { id })
            .select(['u.id as user_id', 'u.fullname as fullname',
            'u.lastlogin as lastlogin', 'role.name as rolename',
            'role.permissions as permissions'])
            .getRawOne();
        return { id: data.user_id, fullname: data.fullname,
            lastlogin: data.lastlogin, rolename: data.rolename,
            permissions: data.permissions };
    }
    update(id, updateUserDto) {
        return this.userRepository.update(id, updateUserDto);
    }
    async delete(id, currentUser) {
        const obj = await this.userRepository.findOne(id);
        if (obj) {
            obj.isActive = false;
            obj.updatedby = currentUser.id;
        }
        return this.userRepository.save(obj);
    }
    async changePassword(body, req) {
        const user = req.user;
        user.password = body.password;
        return this.userRepository.save(user);
    }
};
UserService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(AppUser_entity_1.AppUser)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        auth_helper_1.AuthHelper])
], UserService);
exports.UserService = UserService;
//# sourceMappingURL=user.service.js.map