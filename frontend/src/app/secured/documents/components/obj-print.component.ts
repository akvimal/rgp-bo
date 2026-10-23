import { Component, Input, SimpleChanges } from "@angular/core";

/** The details saved with a document, as "Label value" pairs. Anything unreadable shows nothing rather than breaking the list. */
@Component({
    selector: 'app-obj-print',
    template: `
        <div class="hist-props" *ngIf="output.length">
            <span *ngFor="let i of output"><span class="hist-label">{{i.label}}</span>{{i.value}}</span>
        </div>
    `
})
export class ObjPrintComponent {
    @Input() obj:any;
    @Input() json:boolean = true;
    output:any[] = []

    ngOnChanges(changes:SimpleChanges){
        if(changes.obj) this.parse();
    }

    ngOnInit(){
        this.parse();
    }

    private parse(){
        let v = this.obj;
        try { if(this.json && typeof v === 'string') v = JSON.parse(v); } catch { v = null; }
        this.output = Array.isArray(v) ? v.filter((i:any) => i && i.label && i.value !== undefined && i.value !== null && i.value !== '') : [];
    }
}
