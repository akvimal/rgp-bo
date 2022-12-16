"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const passport_1 = require("@nestjs/passport");
const typeorm_1 = require("@nestjs/typeorm");
const auth_controller_1 = require("./auth.controller");
const auth_helper_1 = require("./auth.helper");
const auth_service_1 = require("./auth.service");
const auth_strategy_1 = require("./auth.strategy");
const config_1 = require("@nestjs/config");
const AppUser_entity_1 = require("../../../entities/AppUser.entity");
const auth_config_1 = require("../../../config/auth.config");
const user_service_1 = require("../users/user.service");
let AuthModule = class AuthModule {
};
AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [
                    auth_config_1.default
                ],
                envFilePath: ['src/.env'],
            }),
            passport_1.PassportModule.register({ defaultStrategy: 'jwt', property: 'user' }),
            jwt_1.JwtModule.registerAsync({
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    secret: config.get('JWT_KEY'),
                    signOptions: { expiresIn: config.get('JWT_EXPIRES') },
                }),
            }),
            typeorm_1.TypeOrmModule.forFeature([AppUser_entity_1.AppUser])],
        controllers: [auth_controller_1.AuthController],
        providers: [auth_service_1.AuthService, user_service_1.UserService, auth_helper_1.AuthHelper, auth_strategy_1.JwtStrategy],
        exports: [auth_helper_1.AuthHelper]
    })
], AuthModule);
exports.AuthModule = AuthModule;
//# sourceMappingURL=auth.module.js.map