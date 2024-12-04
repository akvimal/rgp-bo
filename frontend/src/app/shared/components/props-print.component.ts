import { Component, Input } from "@angular/core";

@Component({
    selector: 'app-props-print',
    templateUrl: `./props-print.component.html`})
export class PropsPrintComponent{
    @Input() props = null;
    attrs:any[] = [];

    ngOnInit(){
        // console.log(this.props);
        if(this.props){
            
            Object.entries(this.props).forEach((p:any) => {
                // console.log(p);
                
                const key = this.capitalize(p[0]);
                if(typeof p[1] == 'object' && Array.isArray(p[1]) && p[1].length > 0){
                    this.attrs.push({key,value:p[1].map(s => s['label'])});
                }
                else if(typeof p[1] == 'boolean' && p[1] == true){
                    this.attrs.push({key,value:'Yes'});
                } else if(typeof p[1] == 'string' && p[1] != ''){
                    this.attrs.push({key,value:p[1]});
                }
            });
        }
    }

    capitalize(str:string){
        return str.substring(0,1).toUpperCase()+str.substring(1);
    }
}