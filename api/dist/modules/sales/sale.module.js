"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SaleModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const approle_entity_1 = require("../../entities/approle.entity");
const customer_entity_1 = require("../../entities/customer.entity");
const sale_item_entity_1 = require("../../entities/sale-item.entity");
const sale_entity_1 = require("../../entities/sale.entity");
const role_service_1 = require("../app/roles/role.service");
const customer_service_1 = require("../customers/customer.service");
const stock_service_1 = require("../inventory/stock.service");
const sale_controller_1 = require("./sale.controller");
const sale_service_1 = require("./sale.service");
let SaleModule = class SaleModule {
};
SaleModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([sale_entity_1.Sale, sale_item_entity_1.SaleItem, customer_entity_1.Customer, approle_entity_1.AppRole])],
        controllers: [sale_controller_1.SaleController],
        providers: [sale_service_1.SaleService, customer_service_1.CustomerService, stock_service_1.StockService, role_service_1.RoleService],
        exports: [sale_service_1.SaleService],
    })
], SaleModule);
exports.SaleModule = SaleModule;
//# sourceMappingURL=sale.module.js.map