import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

@Injectable({
    providedIn: 'root'
})
export class OfferService {
    
    offers = [
        {code:'NONE',amount:0,input:false,available:true},
        {code:'FIRST_NEW',amount:250,input:false,available:true},
        {code:'OTHER',amount:0,input:true,available:true}];
    
    state = new BehaviorSubject(this.offers);


}