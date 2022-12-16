import { EntityManager } from "typeorm";
export declare class StockService {
    private manager;
    constructor(manager: EntityManager);
    findAll(): Promise<any>;
    findByItem(id: any): Promise<any>;
}
