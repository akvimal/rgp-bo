export interface VendorPayment {
    id?: number,
    vendorid?: number,
    invoiceid?: number,
    paydate?: string,
    amount?: number,
    paymode?: string,
    transref?: string,
    communicationstatus?: string,
    communicationchannel?: string,
    communicatedat?: string,
    acknowledgedat?: string,
    acknowledgementreference?: string,
    remarks?: string
}
