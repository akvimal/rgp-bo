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
exports.SaleController = void 0;
const sale_service_1 = require("./sale.service");
const swagger_1 = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const create_sale_dto_1 = require("./dto/create-sale.dto");
const create_saleitem_dto_1 = require("./dto/create-saleitem.dto");
const passport_1 = require("@nestjs/passport");
const user_decorator_1 = require("../../core/decorator/user.decorator");
const customer_service_1 = require("../customers/customer.service");
const stock_service_1 = require("../inventory/stock.service");
const role_service_1 = require("../app/roles/role.service");
let SaleController = class SaleController {
    constructor(saleService, stockService, custService, roleService) {
        this.saleService = saleService;
        this.stockService = stockService;
        this.custService = custService;
        this.roleService = roleService;
    }
    async create(createSaleDto, currentUser) {
        console.log('createSaleDto: ', createSaleDto);
        if (createSaleDto.id) {
            await this.saleService.removeItems(createSaleDto);
        }
        let custAdded = createSaleDto.customer;
        if (custAdded && !custAdded.id) {
            custAdded = await this.custService.create(createSaleDto.customer);
        }
        return this.saleService.create(Object.assign(Object.assign({}, createSaleDto), { customer: custAdded }), currentUser.id);
    }
    async createItem(createSaleItemDto, currentUser) {
        return this.saleService.createItem(createSaleItemDto, currentUser.id);
    }
    async findAllSales() {
        return this.saleService.getSales();
    }
    async findAll(query, currentUser) {
        const role = await this.roleService.findById(currentUser.roleid);
        const sale = Object.values(role.permissions).find((p) => p.resource === 'sales');
        const owned = (!sale.data || sale.data === 'self') ? currentUser.id : undefined;
        return this.saleService.findAll(query, owned);
    }
    async findAllItems(criteria, currentUser) {
        const role = await this.roleService.findById(currentUser.roleid);
        const sale = Object.values(role.permissions).find((p) => p.resource === 'sales');
        const owned = (!sale.data || sale.data === 'self') ? currentUser.id : undefined;
        return this.saleService.findAllItems(criteria, owned);
    }
    async findById(id) {
        const sale = await this.saleService.findById(id);
        const stocks = await this.stockService.findAll();
        const items = sale.items.map((i) => {
            const st = stocks.find(s => s.id === i.itemid);
            return Object.assign(Object.assign({}, i), { maxqty: st.available_qty });
        });
        return Object.assign(Object.assign({}, sale), { items });
    }
    async findItems(custid) {
        const stocks = await this.stockService.findAll();
        const sales = await this.saleService.findAllByCustomerId(custid, 1);
        sales.forEach(s => {
            s.items.forEach((i) => {
                const st = stocks.find(s => s.id === i.itemid);
                i.maxqty = st.available_qty;
            });
        });
        return sales;
    }
    async findAllItemsBySale(id) {
        return this.saleService.findAllItemsBySale(id);
    }
    remove(id, currentUser) {
        return this.saleService.update(id, { isActive: false }, currentUser.id);
    }
    removeItem(id, currentUser) {
        return this.saleService.removeItem(id, currentUser.id);
    }
};
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_sale_dto_1.CreateSaleDto, Object]),
    __metadata("design:returntype", Promise)
], SaleController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('/items'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_saleitem_dto_1.CreateSaleItemDto, Object]),
    __metadata("design:returntype", Promise)
], SaleController.prototype, "createItem", null);
__decorate([
    (0, common_1.Get)('/raw'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SaleController.prototype, "findAllSales", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SaleController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)('/items/criteria'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SaleController.prototype, "findAllItems", null);
__decorate([
    (0, common_1.Get)('/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SaleController.prototype, "findById", null);
__decorate([
    (0, common_1.Get)('/:id/customer'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SaleController.prototype, "findItems", null);
__decorate([
    (0, common_1.Get)('/:id/items'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SaleController.prototype, "findAllItemsBySale", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SaleController.prototype, "remove", null);
__decorate([
    (0, common_1.Delete)('items/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, user_decorator_1.User)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SaleController.prototype, "removeItem", null);
SaleController = __decorate([
    (0, swagger_1.ApiTags)('Sales'),
    (0, common_1.Controller)('sales'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    __metadata("design:paramtypes", [sale_service_1.SaleService,
        stock_service_1.StockService,
        customer_service_1.CustomerService,
        role_service_1.RoleService])
], SaleController);
exports.SaleController = SaleController;
//# sourceMappingURL=sale.controller.js.map