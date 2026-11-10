export interface Customer {
    id?:number,
    
    name:string,
    mobile?:string,
    altmobile?:string,
    email?:string,
    
    address?:string,
    locality?:string,
    area?:string,
    
    srctype?:string,
    srcdesc?:string,

    consent?:string|null,
    doNotContact?:boolean,
    preferredChannel?:string|null,
    messageLanguage?:string|null,

    createdon?:string
}