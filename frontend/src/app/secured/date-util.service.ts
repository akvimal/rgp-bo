import { Injectable } from "@angular/core";

@Injectable({
    providedIn: 'root'
})
export class DateUtilService {

    parseDate(date:any){
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

    formatDate(dateStr:string){
        const arr = dateStr.split('-');
        const dt = new Date();
        dt.setFullYear(+arr[0]);
        dt.setMonth((+arr[1])-1);
        return dt;
      }    

      getFormatDate(dt:Date){
        let mon = dt.getMonth()+1;
        let dat = dt.getDate();
        return dt.getFullYear() + '-' + (mon < 10 ? ('0'+mon) : mon) 
        + '-' + (dat < 10 ? ('0'+dat) : dat);
    }

    getMonthYear(dtstr:string){
        const dt = new Date(dtstr+'-01');
        let mon = dt.getMonth()+1;
        return this.parseMonthText(mon) + '-' + dt.getFullYear()%2000;
    }

    getDateMonth(dtstr:string){
        const dt = new Date(dtstr);
        let mon = dt.getMonth()+1;
        return dt.getDate() +'-'+this.parseMonthText(mon);
    }

    getOtherDate(date:Date,days:number){
        const dt = date;
        dt.setDate(dt.getDate() + days);
        return this.getFormatDate(dt);
    }

    parseMonthText(mon:number){
        let text = ''
        switch (mon) {
            case 1:
                text = 'Jan'
                break;
            case 2:
                text = 'Feb'
                break;
            case 3:
                text = 'Mar'
                break;
            case 4:
                text = 'Apr'
                break;
            case 5:
                text = 'May'
                break;
            case 6:
                text = 'Jun'
                break;
            case 7:
                text = 'Jul'
                break;
            case 8:
                text = 'Aug'
                break;
            case 9:
                text = 'Sep'
                break;
            case 10:
                text = 'Oct'
                break;
            case 11:
                text = 'Nov'
                break;
            case 12:
                text = 'Dec'
                break;
                        
            default:
                break;
        }
        return text;
    }

    isSameDay(date:string){
        const chkdt = new Date(date).getTime();
        
        const enddt = new Date();
        enddt.setHours(23);
        enddt.setMinutes(59);
        enddt.setSeconds(59);

        const hours = (enddt.getTime()-chkdt)/1000/60/60;
        return hours > 0 && hours <= 24;
    }
    
}