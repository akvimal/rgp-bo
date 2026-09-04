import { Component } from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { ReportService } from "../reports.service";
import { saveAs as importedSaveAs } from "file-saver";
import { DateUtilService } from "../../date-util.service";

interface Column {
    field: string;
    header: string;
    type?: 'text' | 'date' | 'numeric';
    align?: 'start' | 'end';
}

@Component({
    templateUrl: 'reports.component.html'
})
export class ReportsComponent {

    data: any[] = [];
    loading = false;
    searched = false;

    cols: Column[] = [
        { field: 'bill_date', header: 'Date', type: 'date' },
        { field: 'bill_no', header: 'Bill No' },
        { field: 'customer', header: 'Customer' },
        { field: 'product', header: 'Product' },
        { field: 'batch', header: 'Batch' },
        { field: 'mrp', header: 'MRP', type: 'numeric', align: 'end' },
        { field: 'qty', header: 'Qty', type: 'numeric', align: 'end' },
        { field: 'price', header: 'Price', type: 'numeric', align: 'end' },
        { field: 'item_total', header: 'Item Total', type: 'numeric', align: 'end' },
        { field: 'sale_total', header: 'Bill Total', type: 'numeric', align: 'end' },
    ];

    form = new FormGroup({
        report: new FormControl('sale'),
        begin: new FormControl(''),
        end: new FormControl('')
    });
    product: any;

    constructor(private service: ReportService, private dateService: DateUtilService) {}

    ngOnInit() {
        const today = this.dateService.getFormatDate(new Date());
        this.form.controls['begin'].setValue(today);
        this.form.controls['end'].setValue(today);
    }

    get grandTotal(): number {
        return (this.data || []).reduce((sum, row) => sum + Number(row.item_total || 0), 0);
    }

    propsUpdate(event: any, entity: string) {
        this.product = entity == 'product' && event.values;
    }

    onSubmit(action: string) {
        let criteria: any = { ...this.form.value };

        if (criteria.begin === '' && criteria.end !== '') criteria.begin = criteria.end;
        if (criteria.begin !== '' && criteria.end === '') criteria.end = criteria.begin;
        if (criteria.begin === '' && criteria.end === '') return;

        if (this.product) {
            criteria = { ...criteria, product: this.product };
        }

        if (action === 'search') {
            this.loading = true;
            this.searched = true;
        }

        this.service.search({ action, criteria }).subscribe({
            next: (result: any) => {
                if (action == 'export') {
                    importedSaveAs(new Blob([result]), 'sale-report.xlsx');
                } else {
                    this.data = result || [];
                    this.loading = false;
                }
            },
            error: () => {
                this.loading = false;
            }
        });
    }
}
