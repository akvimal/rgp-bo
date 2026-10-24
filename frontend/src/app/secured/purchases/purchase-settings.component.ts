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
        purchaseOrderPdfShowBuyerDetails: new FormControl(true),
        purchaseOrderSignatures: new FormControl('', [Validators.maxLength(600), (c: any) => `${c.value || ''}`.split(/\r?\n/).filter((l: string) => l.trim()).length > 3 ? { tooMany: true } : null]),
        purchaseOrderTerms: new FormControl('', [Validators.maxLength(2000), (c: any) => `${c.value || ''}`.split(/\r?\n/).filter((l: string) => l.trim()).length > 12 ? { tooMany: true } : null])
    });

    /** what is printed when no terms have been written */
    readonly standardTerms = [
        'Please supply the above items as per the agreed rates and schedule.',
        'Goods should be delivered against this purchase order number.',
        'Invoice should quote this PO number for settlement.'
    ];
    readonly standardSignatures = [
        'Authorised signatory | Prepared by {preparedBy} | For {business}',
        'Vendor acceptance | Signature, seal and date'
    ];
    saved = false;

    constructor(private service: SettingService) {}

    ngOnInit() {
        this.service.findAll({ category: 'purchases' }).subscribe((settings:any) => {
            settings.forEach((setting:any) => this.currentSettings[setting.key] = setting);
            this.form.controls['purchaseOrderApprovalValueThreshold'].setValue(this.currentSettings['purchase_order_approval_value_threshold']?.value || '5000');
            this.form.controls['purchaseOrderPdfShowBuyerDetails'].setValue(this.asBool(this.currentSettings['purchase_order_pdf_show_buyer_details']?.value, true));
            this.form.controls['purchaseOrderTerms'].setValue(this.currentSettings['purchase_order_terms']?.value || '');
            this.form.controls['purchaseOrderSignatures'].setValue(this.currentSettings['purchase_order_signatures']?.value || '');
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
            },
            {
                key: 'purchase_order_signatures',
                value: `${this.form.value.purchaseOrderSignatures || ''}`.split(/\r?\n/).map((l:string) => l.trim()).filter(Boolean).join('\n'),
                description: 'Signature blocks at the foot of the purchase order PDF, one per line: caption | note | text above the line'
            },
            {
                key: 'purchase_order_terms',
                value: `${this.form.value.purchaseOrderTerms || ''}`.split(/\r?\n/).map((l:string) => l.trim()).filter(Boolean).join('\n'),
                description: 'Terms and conditions printed on the purchase order PDF, one per line'
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
            this.saved = true;
            setTimeout(() => this.saved = false, 3000);
        });
    }
}
