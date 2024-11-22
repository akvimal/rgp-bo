export interface SaleDelivery {
    id?:number,
    saleid?:number,
    bookeddate?: string,
    bookedby?: number,
    receivername?: string,
    receiverphone?: string,
    receiveraddress?: string,
    charges?: number,
    deliverydate?: string,
    deliveryby?: number,
    status?:string,
    comments?:string
}