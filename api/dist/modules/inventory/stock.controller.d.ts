import { StockService } from "./stock.service";
export declare class StockController {
    private service;
    constructor(service: StockService);
    findAll(): Promise<any>;
}
