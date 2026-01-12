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
    status:string,

    // Phase 3: Enhanced Invoice Lifecycle
    itemtype?: 'REGULAR' | 'RETURN' | 'SUPPLIED',
    challanref?: string,
    returnreason?: string,

    // Tax breakdown (computed from taxpcnt and total)
    cgstpcnt?: number,
    sgstpcnt?: number,
    igstpcnt?: number,
    cgstamount?: number,
    sgstamount?: number,
    igstamount?: number,

    // Timestamps
    createdon?: string,
    updatedon?: string,
    createdby?: number,
    updatedby?: number
}