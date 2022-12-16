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
exports.ProductService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const product_price_entity_1 = require("../../entities/product-price.entity");
const product_entity_1 = require("../../entities/product.entity");
const typeorm_2 = require("typeorm");
let ProductService = class ProductService {
    constructor(productRepository, priceRepository) {
        this.productRepository = productRepository;
        this.priceRepository = priceRepository;
    }
    async create(createProductDto, userid) {
        return this.productRepository.save(Object.assign(Object.assign({}, createProductDto), { createdby: userid }));
    }
    async createPrice(dto, userid) {
        return this.priceRepository.save(Object.assign(Object.assign({}, dto), { createdby: userid }));
    }
    async findAll(query, user) {
        const qb = this.productRepository.createQueryBuilder(`p`)
            .where('p.isActive = :flag', { flag: true });
        if (query.category) {
            qb.andWhere(`p.category = :ctg`, { ctg: query.category });
        }
        return qb.getMany();
    }
    async findAllPriceByItem(id) {
        return this.priceRepository.createQueryBuilder(`p`)
            .where('p.itemid = :id', { id }).getMany();
    }
    findById(id) {
        return this.productRepository.findOne(id);
    }
    async update(id, values, userid) {
        return this.productRepository.update(id, Object.assign(Object.assign({}, values), { updatedby: userid }));
    }
    async updatePrice(id, values, userid) {
        return this.priceRepository.update(id, Object.assign(Object.assign({}, values), { updatedby: userid }));
    }
};
ProductService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(product_entity_1.Product)),
    __param(1, (0, typeorm_1.InjectRepository)(product_price_entity_1.ProductPrice)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], ProductService);
exports.ProductService = ProductService;
//# sourceMappingURL=product.service.js.map