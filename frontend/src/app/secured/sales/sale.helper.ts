import { Injectable } from "@angular/core";
import { SaleItem } from "./models/sale-item.model";

@Injectable({
    providedIn: 'root'
})
export class SaleHelper {

    mapStockToSaleItem(source:any,editable:boolean){
        const output = source;
        if(source){
            const price = ((source.sale_price ||  source.mrp)/source.product_pack).toFixed(2)
            const total = (+price * source.product_pack).toFixed(2);
    
            output.itemid = source.purchase_itemid;
            output.product_id = source.product_id;
            output.title = source.product_title;
            output.batch = source.product_batch;
            output.expdate = source.product_expdate;
            output.qty = source.product_pack; //default qty to pack
            output.maxqty = source.available;
            output.pack = source.product_pack;
            output.mrpcost = (source.mrp/source.product_pack).toFixed(2);
            output.price = price;
            output.taxpcnt = source.product_taxpcnt;
              // more_props = event.more_props;
            output.unitsbal = source.available - source.product_pack,
            output.total = total;
            output['edited'] = editable;
        }
        // console.log(output);
        
        return output;
    }

    transform(source:any):SaleItem{
        const output = source;
        if(source){
            output['title'] = source.product.title;
            output['edited'] = true;
            // output.unitsbal = source.available - source.product_pack,
        }
        return output;
    }

    mapSaleItemInputToSave(saleItemInput:any,saleStatus:any){
        
        let itemStatus =  '';
        switch (saleStatus) {
            case 'COMPLETE':
                itemStatus = 'Complete'
                break;
            case 'PENDING':
                    itemStatus = 'Pending'
                break;
            default:
                break;
        }

        return {
            productid:saleItemInput['product_id'],
            itemid:saleItemInput['itemid'],
            batch:saleItemInput['batch'],
            expdate:saleItemInput['expdate'],
            qty:saleItemInput['qty'],
            taxpcnt:saleItemInput['taxpcnt'],
            mrpcost:saleItemInput['mrpcost'],
            pack:saleItemInput['pack'],
            price:saleItemInput['price'],
            status: itemStatus,
            total:saleItemInput['total']
        }
    }
}