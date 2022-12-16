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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const AppUser_entity_1 = require("../../../entities/AppUser.entity");
const typeorm_2 = require("typeorm");
const auth_helper_1 = require("./auth.helper");
let AuthService = class AuthService {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    async register(body) {
        const { name, email, password } = body;
        let user = await this.userRepository.findOne({ where: { email } });
        if (user) {
            throw new common_1.HttpException('Conflict', common_1.HttpStatus.CONFLICT);
        }
        user = new AppUser_entity_1.AppUser();
        user.fullname = name;
        user.email = email;
        user.password = this.helper.encodePassword(password);
        return this.userRepository.save(user);
    }
    async login(body) {
        const { email, password } = body;
        const user = await this.userRepository.findOne({ where: { email } });
        if (!user) {
            throw new Error('Invalid Credentials');
        }
        const isPasswordValid = this.helper.isPasswordValid(password, user.password);
        if (!isPasswordValid) {
            throw new Error('Invalid Credentials');
        }
        this.userRepository.update(user.id, { lastlogin: new Date() });
        return { token: this.helper.generateToken(user) };
    }
    async changepwd(body) {
        const { email, password, newpassword } = body;
        const user = await this.userRepository.findOne({ where: { email } });
        if (!user) {
            throw new Error('Invalid Credentials');
        }
        const isPasswordValid = this.helper.isPasswordValid(password, user.password);
        if (!isPasswordValid) {
            throw new Error('Invalid Credentials');
        }
        this.userRepository.update(user.id, { password: this.helper.encodePassword(newpassword), lastlogin: new Date() });
        return { token: this.helper.generateToken(user) };
    }
    async refresh(user) {
        this.userRepository.update(user.id, { lastlogin: new Date() });
        return this.helper.generateToken(user);
    }
};
__decorate([
    (0, common_1.Inject)(auth_helper_1.AuthHelper),
    __metadata("design:type", auth_helper_1.AuthHelper)
], AuthService.prototype, "helper", void 0);
AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(AppUser_entity_1.AppUser)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], AuthService);
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map