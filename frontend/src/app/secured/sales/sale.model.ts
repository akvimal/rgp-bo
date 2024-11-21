import { SaleItem } from "./sale-item.model";

export interface Sale {
    id?:number,
    billno?:any,
    billdate?:any,
    orderno?:any,
    orderdate?:any,
    customerid?:number,
    customer?:any,
    created?:any,
    status?:string,
    items?:SaleItem[],
    total?: number,
    disccode?:string,
    discamount?:number,
    digimethod?:string,
    digirefno?:string,
    digiamt?:number,
    cashamt?:number,
    props?:any,
    mrptotal?:number,
    saving?:number,
    expreturndays?:number,
    totalitems?:number,
    ordertype?:string,
    deliverytype?:string
}