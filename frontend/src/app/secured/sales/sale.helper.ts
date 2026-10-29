import { Injectable } from "@angular/core";
import { SaleItem } from "./models/sale-item.model";

@Injectable({
    providedIn: 'root'
})
export class SaleHelper {

    mapStockToSaleItem(source:any,editable:boolean){
        const output = source;
        if(source){
            // the GST billed is worked out by the server for today (GST > Rate changes: a change of rate by date, and the GST 2.0 cap of 5% from 22-09-2025);
            // a row without it falls back to the batch's own GST
            const taxpcnt = source.sale_tax !== undefined && source.sale_tax !== null ? +source.sale_tax : source.tax_pcnt;
            // the bill adds GST to the price, and a customer is never charged more than the MRP: cap the price at MRP less that GST
            // the server sends the ceiling itself (price_ceiling): a counter user is not shown the MRP
            const mrpUnit = source.mrp_cost / source.pack;
            const ceiling = source.price_ceiling != null && +source.price_ceiling > 0 ? +source.price_ceiling
                : (mrpUnit > 0 ? Math.floor(mrpUnit / (1 + (taxpcnt || 0) / 100) * 100 + 1e-6) / 100 : null);
            let listPrice = source.sale_price / source.pack;
            const capped = ceiling !== null && listPrice > ceiling;
            if (capped) { listPrice = ceiling as number; }
            const price = listPrice.toFixed(2);
            // const total = ((+price * (1 + (source.tax_pcnt/100))) * source.pack).toFixed(2);
            const total = (+price * source.pack).toFixed(2);
            output.itemid = source.item_id;
            output.product_id = source.id;
            output.title = source.title;
            output.batch = source.batch;
            output.expdate = source.exp_date;
            output.qty = source.pack; //default qty to pack
            output.maxqty = source.balance;
            output.pack = source.pack;
            output.mrpcost = (source.mrp_cost/source.pack).toFixed(2);
            output.price = price;
            output.taxpcnt = taxpcnt;
            output.mrpcapped = capped;
              // more_props = event.more_props;
            output.unitsbal = source.balance - source.pack,
            output.total = total;
            output['edited'] = editable;
        }
        
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