import { Component, EventEmitter, Input, Output, SimpleChanges } from "@angular/core";
import { LookupService } from "../lookup.service";

@Component({
    selector: 'app-lookup',
    templateUrl: `./lookup.component.html`})
export class LookupComponent{
    
    @Input() entity = '';
    @Input() property = '';
    @Output() update = new EventEmitter();

    list: any[] | undefined;
    @Input() default:any;
    item:any;

    constructor(private service:LookupService){}

    ngOnChanges(changes:SimpleChanges){
        this.item = changes.default.currentValue;
    }

    search(event:any){
        this.service.find(this.entity,this.property,event.query).subscribe((data:any) => this.list = data);
    }

    onEnter(event:any){
        this.update.emit(this.item);
    }
}