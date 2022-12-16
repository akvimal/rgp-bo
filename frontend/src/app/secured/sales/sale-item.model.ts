export interface SaleItem {
    id?:number,
    saleid?:number,
    sale?:any,
    title?:string,
    props?:any,
    purchaseitemid?:string,
    purchaseitem?:any,
    batch?:string,
    expdate?:string,
    taxpcnt?:string,
    mrp?:string,
    price?:string,
    status?:string,
    comments?:string,
    qty?:string,
    total?: number,
    maxqty?:number
}