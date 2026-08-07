
export interface PurchaseOrder {
    id?:number;
    status?:string;
    ponumber?:string;
    comments?:string;
    expecteddate?:string;
    sourcesummary?:string;
    approvalstatus?:string;
    approvalreason?:string;
    rejectionreason?:string;
    estimatedtotal?:number;
    approvalreasons?:string[];
    vendorid?:number;
    requests?:any;
}
