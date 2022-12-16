"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("@nestjs/config");
exports.default = (0, config_1.registerAs)('auth', () => ({
    secret: process.env.JWT_KEY,
    expires: process.env.JWT_EXPIRES,
}));
//# sourceMappingURL=auth.config.js.map