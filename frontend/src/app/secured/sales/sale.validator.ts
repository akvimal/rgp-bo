import { Injectable } from "@angular/core";
import { Sale } from "./models/sale.model";

@Injectable({
    providedIn: 'root'
})
export class SaleValidator {

    rule = `'items' contains 'props' having 'schedule' equals 'H1' and 'props' having 'document.category' equals 'Prescription'`;

    validate(sale:any,documents:any){
        
        let valid = false;
        
        if(sale.items.length > 0){
            const presitems = sale.items && sale.items.filter((i:any) => i.more_props && i.more_props['document'] == 'Prescription');
            const presdocs = documents && documents.filter((d:any) => d['category'] == 'Prescription');

            if( (presitems.length > 0 && presdocs.length > 0) || presitems.length == 0 || sale.docpending){
            valid = true;
            }
        }
        return valid;
    }

}
