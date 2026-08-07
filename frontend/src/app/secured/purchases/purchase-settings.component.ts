import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { forkJoin } from "rxjs";
import { SettingService } from "../settings/settings.service";

@Component({
    templateUrl: 'purchase-settings.component.html'
})
export class PurchaseSettingsComponent {
    currentSettings:any = {};

    form:FormGroup = new FormGroup({
        purchaseOrderApprovalValueThreshold: new FormControl('5000', Validators.required),
        purchaseOrderPdfShowBuyerDetails: new FormControl(true)
    });

    constructor(private service: SettingService) {}

    ngOnInit() {
        this.service.findAll({ category: 'purchases' }).subscribe((settings:any) => {
            settings.forEach((setting:any) => this.currentSettings[setting.key] = setting);
            this.form.controls['purchaseOrderApprovalValueThreshold'].setValue(this.currentSettings['purchase_order_approval_value_threshold']?.value || '5000');
            this.form.controls['purchaseOrderPdfShowBuyerDetails'].setValue(this.asBool(this.currentSettings['purchase_order_pdf_show_buyer_details']?.value, true));
        });
    }

    asBool(value:any, fallback:boolean){
        if(value === undefined || value === null || `${value}`.trim() === ''){
            return fallback;
        }
        return ['1','true','yes','y','on'].includes(`${value}`.trim().toLowerCase());
    }

    onSave() {
        const payloads = [
            {
                key: 'purchase_order_approval_value_threshold',
                value: `${this.form.value.purchaseOrderApprovalValueThreshold}`,
                description: 'Approval required above this estimated PO value'
            },
            {
                key: 'purchase_order_pdf_show_buyer_details',
                value: `${!!this.form.value.purchaseOrderPdfShowBuyerDetails}`,
                description: 'Show buyer/pharmacy details on vendor purchase order PDF'
            }
        ];

        const requests = payloads.map((payload:any) => {
            const existing = this.currentSettings[payload.key];
            return existing ? this.service.update(existing.id, { category: 'purchases', ...payload }) : this.service.save({ category: 'purchases', ...payload });
        });

        forkJoin(requests).subscribe((data:any[]) => {
            data.forEach((setting:any) => {
                this.currentSettings[setting.key] = setting;
            });
        });
    }
}
