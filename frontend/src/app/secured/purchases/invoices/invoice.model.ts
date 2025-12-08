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

    // Legacy payment fields (deprecated - use VendorPayment instead)
    payamount?:number,
    paycomments?:string,
    paydate?:string,
    paymode?:string,
    payrefno?:string,

    // Phase 3: Enhanced Invoice Lifecycle
    doctype?: 'INVOICE' | 'DELIVERY_CHALLAN',
    paymentstatus?: 'UNPAID' | 'PARTIAL' | 'PAID',
    paidamount?: number,
    taxstatus?: 'PENDING' | 'FILED' | 'CREDITED' | 'RECONCILED' | 'MISMATCH',
    lifecyclestatus?: 'OPEN' | 'CLOSED',

    // Tax breakdown
    taxamount?: number,
    cgstamount?: number,
    sgstamount?: number,
    igstamount?: number,
    totaltaxcredit?: number,

    // Tax reconciliation
    taxfilingmonth?: string,
    taxreconciledon?: string,
    taxreconciledby?: number,

    // Invoice closure
    closedon?: string,
    closedby?: number,
    closurenotes?: string,

    // Timestamps
    createdon?: string,
    updatedon?: string,
    createdby?: number,
    updatedby?: number
}

export interface VendorPayment {
    id?: number,
    invoiceid: number,
    vendorid: number,
    amount: number,
    paymentdate: string,
    paymentmode: string,
    paymenttype: 'ADVANCE' | 'PARTIAL' | 'FULL',
    paymentstatus: 'PENDING' | 'COMPLETED' | 'FAILED',
    paymentagainst?: 'INVOICE' | 'DELIVERY_CHALLAN',

    // Payment details
    bankname?: string,
    chequeno?: string,
    utrno?: string,
    paymentproofdocid?: number,

    // Reconciliation
    reconciled?: boolean,
    reconciledon?: string,
    reconciledby?: number,
    notes?: string,

    // Timestamps
    createdon?: string,
    createdby?: number
}

export interface TaxCredit {
    id?: number,
    invoiceid: number,

    // GST Filing Details
    gstfilingmonth: string,
    vendorgstin: string,

    // Tax Amounts
    taxableamount: number,
    cgstamount?: number,
    sgstamount?: number,
    igstamount?: number,
    totaltaxcredit: number,

    // Filing Status
    filingstatus: 'PENDING' | 'FILED_BY_VENDOR' | 'REFLECTED_IN_2A' | 'CLAIMED',
    fileddate?: string,
    reflectedin2adate?: string,
    claimedinreturn?: string,
    claimeddate?: string,

    // Mismatch Handling
    hasmismatch?: boolean,
    mismatchreason?: string,
    mismatchamount?: number,
    mismatchresolved?: boolean,
    mismatchresolutionnotes?: string,

    // Supporting Documents
    gstr1docid?: number,
    gstr2adocid?: number,

    // Additional Info
    notes?: string,

    // Timestamps
    createdon?: string,
    createdby?: number
}

export interface InvoiceLifecycleSummary {
    invoice: Invoice,
    itemsummary: {
        total: number,
        verified: number,
        pending: number
    },
    paymentsummary: {
        totalamount: number,
        paidamount: number,
        outstandingamount: number,
        paymentcount: number,
        paymentstatus: string
    },
    taxsummary: {
        totaltaxcredit: number,
        taxstatus: string,
        filingstatus?: string
    },
    cancloseinvoice: boolean,
    closureblockers: string[]
}