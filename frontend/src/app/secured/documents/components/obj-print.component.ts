import { Component, Input, SimpleChanges } from "@angular/core";

@Component({
    selector: 'app-obj-print',
    template: `
        <table>
        <tr *ngFor="let i of output">
            <td>{{i.label}}</td><td style="color:blue;">{{i.value}}</td>
        </tr>
        </table>
    `
})
export class ObjPrintComponent {
    @Input() obj:any;
    @Input() json:boolean = true;
    output:any[] = []

    ngOnChanges(changes:SimpleChanges){
        if(changes.obj.currentValue){
            this.output = this.json ? JSON.parse(changes.obj.currentValue) : changes.obj.currentValue;
        }
    }

    ngOnInit(){
        this.output = this.json ? JSON.parse(this.obj) : this.obj;
    }
}