"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const database_config_1 = require("./config/database.config");
const typeorm_config_service_1 = require("./database/typeorm-config.service");
const role_module_1 = require("./modules/app/roles/role.module");
const customer_module_1 = require("./modules/customers/customer.module");
const product_module_1 = require("./modules/products/product.module");
const invoice_module_1 = require("./modules/purchases/invoice.module");
const sale_module_1 = require("./modules/sales/sale.module");
const user_module_1 = require("./modules/app/users/user.module");
const vendor_module_1 = require("./modules/vendors/vendor.module");
const core_1 = require("@nestjs/core");
const errors_interceptor_1 = require("./core/errors.interceptor");
const inventory_module_1 = require("./modules/inventory/inventory.module");
let AppModule = class AppModule {
};
AppModule = __decorate([
    (0, common_1.Module)({
        controllers: [],
        providers: [{
                provide: core_1.APP_INTERCEPTOR,
                useClass: errors_interceptor_1.ErrorsInterceptor,
            },],
        imports: [config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [
                    database_config_1.default
                ],
                envFilePath: ['.env'],
            }),
            typeorm_1.TypeOrmModule.forFeature([]),
            typeorm_1.TypeOrmModule.forRootAsync({
                useClass: typeorm_config_service_1.TypeOrmConfigService,
            }),
            role_module_1.RoleModule,
            user_module_1.UserModule,
            product_module_1.ProductModule,
            vendor_module_1.VendorModule,
            invoice_module_1.PurchaseInvoiceModule,
            customer_module_1.CustomerModule,
            sale_module_1.SaleModule,
            inventory_module_1.InventoryModule
        ]
    })
], AppModule);
exports.AppModule = AppModule;
//# sourceMappingURL=app.module.js.map