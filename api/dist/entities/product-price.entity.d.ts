import { BaseEntity } from "./base.entity";
export declare class ProductPrice extends BaseEntity {
    id: number;
    itemid: number;
    price: number;
    effdate: Date;
    comments: string | null;
}
