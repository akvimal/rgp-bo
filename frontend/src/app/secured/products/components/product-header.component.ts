import { Component } from "@angular/core";

@Component({
    selector: 'app-product-header',
    templateUrl: 'product-header.component.html',
    styles: [`.is-active { background-color: #ada; color: #000; }
    .navbar {padding:0;margin-bottom:1em;}
    `]
})
export class ProductHeaderComponent {
    // selectCustomer(customer:any){
    //     const {id,name,mobile,email,address} = customer;
    //     console.log(customer);
        
    //   }
    //   doneEnterCustomer(event:any){
    //     const inputval = event.target.value;
    //     if(inputval.length > 0){
    //       if(inputval.length !== 10) {
    //         event.target.value = inputval.substring(0,10)
    //         event.target.focus();
    //       }
    //     } 
    //   }
}