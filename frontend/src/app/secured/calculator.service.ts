import { Injectable } from "@angular/core";

@Injectable({
    providedIn: 'root'
})
export class CalculatorService {

    getMargin(ptr:number,sp:number) {
        return Math.round(((sp-ptr) / ptr) * 100);
    }

    getSaving(mrp:number,sp:number) {
        return Math.round(((mrp-sp) / mrp) * 100);
    }

    parseExpDate(date:any){
        let mon = 0
        let day = 0
        let yr = 0
        
        if(typeof date === 'object'){
            day = date.getDay();
            mon = date.getMonth() + 1;
            yr = date.getFullYear();
        }
        else {
            const arr = date.split('/');
            mon = arr[0] + 1;
            yr = arr[1];
        }
        return yr+'-'+(mon < 10 ? '0'+mon : ''+mon)+'-01';;
    }

    formatExpDate(dateStr:string){
        const arr = dateStr.split('-');
        const dt = new Date();
        dt.setFullYear(+arr[0]);
        dt.setMonth((+arr[1])-1);
        return dt;//arr[1]+'/'+arr[0];
      }    
}