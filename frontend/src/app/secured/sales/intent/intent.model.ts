export interface SalesIntentItem {
    id?: number;
    intentid?: number;
    prodid?: number;
    product?: any;
    productname: string;
    requestedqty: number;
    estimatedcost?: number;
    itemnotes?: string;
    active?: boolean;
    archive?: boolean;
    createdon?: string;
    updatedon?: string;
    createdby?: number;
    updatedby?: number;
}

export interface SalesIntent {
    id?: number;
    intentno?: string;
    intenttype: 'CUSTOMER_REQUEST' | 'LOW_STOCK' | 'MARKET_DEMAND' | 'OTHER';
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    prodid?: number;
    product?: any;
    productname: string;
    requestedqty: number;
    items?: SalesIntentItem[];
    totalitems?: number;
    totalestimatedcost?: number;
    customerid?: number;
    customer?: any;
    customername?: string;
    customermobile?: string;
    advanceamount?: number;
    estimatedcost?: number;
    status?: 'PENDING' | 'IN_PO' | 'FULFILLED' | 'CANCELLED';
    fulfillmentstatus?: 'NOT_STARTED' | 'PO_CREATED' | 'GOODS_RECEIVED' | 'CUSTOMER_NOTIFIED' | 'DELIVERED';
    requestnotes?: string;
    internalnotes?: string;
    purchaseorderid?: number;
    purchaseorder?: any;
    fulfilledon?: string;
    notifiedon?: string;
    deliveredon?: string;
    active?: boolean;
    archive?: boolean;
    createdon?: string;
    updatedon?: string;
    createdby?: number;
    updatedby?: number;
}

export interface SalesIntentItemDto {
    prodid?: number;
    productname: string;
    requestedqty: number;
    estimatedcost?: number;
    itemnotes?: string;
}

export interface CreateSalesIntentDto {
    intenttype: 'CUSTOMER_REQUEST' | 'LOW_STOCK' | 'MARKET_DEMAND' | 'OTHER';
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    items?: SalesIntentItemDto[];
    prodid?: number;
    productname?: string;
    requestedqty?: number;
    customerid?: number;
    customername?: string;
    customermobile?: string;
    advanceamount?: number;
    estimatedcost?: number;
    requestnotes?: string;
    internalnotes?: string;
}

export interface UpdateSalesIntentDto {
    intenttype?: 'CUSTOMER_REQUEST' | 'LOW_STOCK' | 'MARKET_DEMAND' | 'OTHER';
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    prodid?: number;
    productname?: string;
    requestedqty?: number;
    customerid?: number;
    customername?: string;
    customermobile?: string;
    advanceamount?: number;
    estimatedcost?: number;
    status?: 'PENDING' | 'IN_PO' | 'FULFILLED' | 'CANCELLED';
    fulfillmentstatus?: 'NOT_STARTED' | 'PO_CREATED' | 'GOODS_RECEIVED' | 'CUSTOMER_NOTIFIED' | 'DELIVERED';
    requestnotes?: string;
    internalnotes?: string;
    purchaseorderid?: number;
}
