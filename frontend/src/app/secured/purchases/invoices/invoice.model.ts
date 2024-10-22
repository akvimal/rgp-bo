export interface Invoice {
    id?:number,
    invoiceno?:string,
    grno?:string,
    invoicedate?:string,
    vendorid?:number,
    purchaseorderid?:number,
    vendor?:any,
    status?:string,
    total?:number,
    items?:any[],
    payamount?:number,
    paycomments?:string,
    paydate?:string,
    paymode?:string,
    payrefno?:string
}