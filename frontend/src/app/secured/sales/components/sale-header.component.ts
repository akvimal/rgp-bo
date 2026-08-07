import { Component, OnDestroy } from "@angular/core";
import { Subscription } from "rxjs";
import { OperatorContextService } from "src/app/@core/operator-context.service";

@Component({
    selector: 'app-sale-header',
    templateUrl: 'sale-header.component.html'
})
export class SaleHeaderComponent implements OnDestroy {

    operators: any[] = [];
    selectedOperatorId: number | null = null;
    private sub = new Subscription();

    constructor(private operatorContext: OperatorContextService) {}

    ngOnInit() {
        this.sub.add(this.operatorContext.operators$.subscribe(ops => this.operators = ops || []));
        this.sub.add(this.operatorContext.selectedOperatorId$.subscribe(id => this.selectedOperatorId = id));
    }

    ngOnDestroy() { this.sub.unsubscribe(); }

    changeOperator(event: any) {
        const value = event.target.value;
        this.operatorContext.setSelectedOperator(value === '' ? null : Number(value));
    }
}