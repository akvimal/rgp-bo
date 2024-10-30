export interface SaleItem {
    id?:number,
    saleid?:number,
    sale?:any,
    title?:string,
    props?:any,
    productid?:number,
    purchaseitemid?:string,
    purchaseitem?:any,
    batch?:string,
    expdate?:string,
    taxpcnt?:string,
    mrp?:string,
    pack?:number,
    price?:number,
    status?:string,
    comments?:string,
    qty?:number,
    total?: number,
    maxqty?:number,
    box?:number,
    boxbal?:number,
    selected?:boolean,
    qtyready?:boolean
}