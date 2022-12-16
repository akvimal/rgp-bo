import { Product } from "../../products/product.model"

export interface InvoiceItem {
    id?:number,
    invid?:number,
    prodid?:string,
    product?:Product,
    batch?:string,
    expdate?:string,
    ptrcost?:number,
    mrpcost?:number,
    taxpcnt?:number,
    saleprice?:number,
    qty?:number,
    total?:number,
    status:string
}