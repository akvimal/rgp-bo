import { SaleItem } from "./sale-item.model";

export interface Sale {
    id?:number,
    billdate?:any,
    customerid?:number,
    customer?:any,
    created?:any,
    status?:string,
    items?:SaleItem[],
    total?: number,
    paymode?:string,
    payrefno?:string,
    props?:any
}