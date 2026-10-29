import { AuthService } from "src/app/@core/auth/auth.service";
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
    selectedOperatorName = '';
    selfOnly = false;
    /** the store asks who is serving on each bill */
    required = true;
    private sub = new Subscription();

    constructor(private operatorContext: OperatorContextService, public auth: AuthService) {}

    ngOnInit() {
        this.sub.add(this.operatorContext.operators$.subscribe(ops => this.operators = ops || []));
        this.sub.add(this.operatorContext.selectedOperatorId$.subscribe(id => this.selectedOperatorId = id));
        this.sub.add(this.operatorContext.selectedOperatorName$.subscribe(n => this.selectedOperatorName = n || ''));
        this.sub.add(this.operatorContext.selfOnly$.subscribe(v => this.selfOnly = v));
        this.sub.add(this.operatorContext.required$.subscribe(v => this.required = v));
    }

    ngOnDestroy() { this.sub.unsubscribe(); }

    changeOperator(event: any) {
        const value = event.target.value;
        this.operatorContext.setSelectedOperator(value === '' ? null : Number(value));
    }
}