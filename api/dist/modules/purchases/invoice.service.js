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
exports.PurchaseInvoiceService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const purchase_invoice_item_entity_1 = require("../../entities/purchase-invoice-item.entity");
const purchase_invoice_entity_1 = require("../../entities/purchase-invoice.entity");
const typeorm_2 = require("typeorm");
let PurchaseInvoiceService = class PurchaseInvoiceService {
    constructor(purchaseInvoiceRepository, purchaseInvoiceItemRepository) {
        this.purchaseInvoiceRepository = purchaseInvoiceRepository;
        this.purchaseInvoiceItemRepository = purchaseInvoiceItemRepository;
    }
    async create(dto, userid) {
        return this.purchaseInvoiceRepository.save(Object.assign(Object.assign({}, dto), { createdby: userid }));
    }
    async createItem(dto, userid) {
        return this.purchaseInvoiceItemRepository.save(Object.assign(Object.assign({}, dto), { createdby: userid }));
    }
    async findAll() {
        return this.purchaseInvoiceRepository.createQueryBuilder('invoice')
            .innerJoinAndSelect("invoice.vendor", "vendor")
            .select(['invoice', 'vendor.name'])
            .where('invoice.active = :flag', { flag: true })
            .getMany();
    }
    async findById(id) {
        return this.purchaseInvoiceRepository.createQueryBuilder('invoice')
            .innerJoinAndSelect("invoice.vendor", "vendor")
            .leftJoinAndSelect("invoice.items", "items")
            .leftJoinAndSelect("items.product", "product")
            .select(['invoice', 'vendor.name', 'items', 'product'])
            .where('invoice.id = :id', { id })
            .getOne();
    }
    async findItemById(id) {
        return this.purchaseInvoiceItemRepository.createQueryBuilder('item')
            .where('item.id = :id', { id })
            .getOne();
    }
    async findAllItemsByInvoice(id) {
        return this.purchaseInvoiceItemRepository.createQueryBuilder('i')
            .where('i.invoiceid = :id', { id })
            .getMany();
    }
    async findAllItems(criteria) {
        return this.purchaseInvoiceItemRepository.createQueryBuilder('item')
            .innerJoinAndSelect("item.product", "product")
            .select(['item', 'product'])
            .where("status = :status", { status: criteria.status || 'NEW' })
            .getMany();
    }
    async update(ids, values, userid) {
        console.log('USER id: ', userid);
        return this.purchaseInvoiceRepository.createQueryBuilder('invoice')
            .update(purchase_invoice_entity_1.PurchaseInvoice, Object.assign(Object.assign({}, values), { updatedby: userid }))
            .where("id in (:...ids)", { ids })
            .execute();
    }
    async updateItems(ids, values, userid) {
        return this.purchaseInvoiceItemRepository.createQueryBuilder('items')
            .update(purchase_invoice_item_entity_1.PurchaseInvoiceItem, Object.assign(Object.assign({}, values), { updatedby: userid }))
            .where("id in (:...ids)", { ids })
            .execute();
    }
    async removeItems(ids) {
        return this.purchaseInvoiceItemRepository.createQueryBuilder('items')
            .delete()
            .from(purchase_invoice_item_entity_1.PurchaseInvoiceItem)
            .where("id in (:...ids)", { ids })
            .execute();
    }
};
PurchaseInvoiceService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(purchase_invoice_entity_1.PurchaseInvoice)),
    __param(1, (0, typeorm_1.InjectRepository)(purchase_invoice_item_entity_1.PurchaseInvoiceItem)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], PurchaseInvoiceService);
exports.PurchaseInvoiceService = PurchaseInvoiceService;
//# sourceMappingURL=invoice.service.js.map