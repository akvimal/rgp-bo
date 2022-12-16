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
exports.SaleService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const sale_item_entity_1 = require("../../entities/sale-item.entity");
const sale_entity_1 = require("../../entities/sale.entity");
const typeorm_3 = require("typeorm");
let SaleService = class SaleService {
    constructor(saleRepository, saleItemRepository, manager) {
        this.saleRepository = saleRepository;
        this.saleItemRepository = saleItemRepository;
        this.manager = manager;
    }
    async create(sale, userid) {
        return this.saleRepository.save(Object.assign(Object.assign({}, sale), { createdby: userid })).then(data => {
            console.log('data: ', data);
            data.items.forEach(i => {
                i.saleid = data.id;
            });
            return this.saleItemRepository.save(data.items).then(d => {
                return new Promise(async (resolve, reject) => {
                    const sale = await this.findById(data.id);
                    resolve(sale);
                });
            });
        });
    }
    async removeItems(createSaleDto) {
        return await this.saleItemRepository.delete({ saleid: createSaleDto.id });
    }
    async createItem(createSaleItemDto, userid) {
        return this.saleItemRepository.save(Object.assign(Object.assign({}, createSaleItemDto), { createdby: userid }));
    }
    async findAll(query, userid) {
        const qb = this.saleRepository.createQueryBuilder("sale")
            .leftJoinAndSelect("sale.customer", "customer")
            .leftJoinAndSelect("sale.created", "created")
            .select(['sale', 'customer', 'customer.name', 'customer.mobile', 'created.id', 'created.fullname'])
            .where('sale.active = :flag', { flag: true });
        if (userid) {
            qb.andWhere('sale.createdby = :uid', { uid: userid });
        }
        if (query.date) {
            qb.andWhere(`DATE_TRUNC('day', sale.createdon) = :con`, { con: query.date });
        }
        if (query.customer) {
            qb.andWhere(`customer.id = :cid`, { cid: query.customer });
        }
        if (query.status) {
            qb.andWhere(`sale.status = :st`, { st: query.status });
        }
        qb.orderBy('sale.createdon', 'DESC');
        return qb.getMany();
    }
    async findAllItems(query, userid) {
        const qb = await this.saleItemRepository.createQueryBuilder("item")
            .leftJoinAndSelect("item.sale", "sale")
            .leftJoinAndSelect("sale.customer", "customer")
            .leftJoinAndSelect("item.purchaseitem", "purchaseitem")
            .leftJoinAndSelect("purchaseitem.product", "product")
            .select(['item', 'sale', 'customer', 'purchaseitem', 'product'])
            .where('sale.status = :st', { st: 'COMPLETE' });
        if (query.category) {
            qb.andWhere('product.category = :ctg', { ctg: query.category });
        }
        if (query.fromdate && query.todate) {
            qb.andWhere('sale.billdate >= :from and sale.billdate <= :to', { from: query.fromdate, to: query.todate });
        }
        if (userid) {
            qb.andWhere('sale.createdby = :uid', { uid: userid });
        }
        if (query.props) {
            query.props.forEach(p => {
                qb.andWhere(`product.more_props->>'${p.id}' = :value`, { value: p.value });
            });
        }
        qb.orderBy('sale.billdate', 'DESC');
        return qb.getMany();
    }
    async findAllByCustomerId(custid, limit) {
        const saleids = await this.manager.query(`
        select s.id
        from pharma4.sale s where s.status = 'COMPLETE' and s.customer_id = ${custid} order by s.bill_date desc limit ${limit}`);
        const ids = saleids.map(i => i.id);
        return await this.saleRepository.createQueryBuilder("sale")
            .innerJoinAndSelect("sale.customer", "customer")
            .leftJoinAndSelect("sale.items", "items")
            .leftJoinAndSelect("items.purchaseitem", "purchaseitem")
            .leftJoinAndSelect("purchaseitem.product", "product")
            .select(['sale', 'customer', 'items', 'purchaseitem', 'product'])
            .where(`sale.status = 'COMPLETE' and sale.id in (${ids.join(',')})`)
            .getMany();
    }
    async getSales() {
        return await this.manager.query(`   
        select s.id, s.bill_date, s.status , s.customer_id, c.name, c.mobile, ss.itemcount, ss.total 
        from pharma4.sale s inner join 
        (select sale_id, count(*) as itemcount, sum(qty * price) as total from pharma4.sale_item group by sale_id) ss on ss.sale_id = s.id
        inner join pharma4.customer c on c.id = s.customer_id `);
    }
    async findById(id) {
        return await this.saleRepository.createQueryBuilder("sale")
            .leftJoinAndSelect("sale.customer", "customer")
            .leftJoinAndSelect("sale.items", "items")
            .leftJoinAndSelect("items.purchaseitem", "purchaseitem")
            .leftJoinAndSelect("purchaseitem.product", "product")
            .select(['sale', 'customer', 'items', 'purchaseitem', 'product'])
            .where('sale.id = :id', { id })
            .getOne();
    }
    async findAllItemsBySale(id) {
        return this.saleItemRepository.createQueryBuilder('si')
            .where('si.saleid = :id', { id })
            .getMany();
    }
    async update(id, values, userid) {
        await this.saleRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
            const obj = await this.saleRepository.findOne({ id });
            await transaction.update(sale_entity_1.Sale, id, Object.assign(Object.assign(Object.assign({}, obj), values), { updatedby: userid }));
        });
    }
    async removeItem(itemid, userid) {
        await this.saleItemRepository.manager.transaction('SERIALIZABLE', async (transaction) => {
            await transaction.update(sale_item_entity_1.SaleItem, itemid, { isArchived: true, updatedby: userid });
        });
    }
};
SaleService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(sale_entity_1.Sale)),
    __param(1, (0, typeorm_1.InjectRepository)(sale_item_entity_1.SaleItem)),
    __param(2, (0, typeorm_1.InjectEntityManager)()),
    __metadata("design:paramtypes", [typeorm_3.Repository,
        typeorm_3.Repository,
        typeorm_2.EntityManager])
], SaleService);
exports.SaleService = SaleService;
//# sourceMappingURL=sale.service.js.map