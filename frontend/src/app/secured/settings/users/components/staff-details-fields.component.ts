import { Component, Input } from "@angular/core";

/** The short staff details (designation, joining date, emergency contact, pharmacist registration) shared by the Users forms. */
@Component({
    selector: 'app-staff-details-fields',
    template: `
    <div class="row g-2" data-testid="staff-details-fields">
        <div class="col-md-3"><label class="form-label">Designation</label><input class="form-control" maxlength="60" [(ngModel)]="model.designation" [ngModelOptions]="{standalone: true}" placeholder="e.g. Pharmacist" data-testid="sd-designation"></div>
        <div class="col-md-3"><label class="form-label">Joined</label><input type="date" class="form-control" [(ngModel)]="model.join_date" [ngModelOptions]="{standalone: true}" data-testid="sd-joined"></div>
        <div class="col-md-3"><label class="form-label">Emergency contact</label><input class="form-control" maxlength="80" [(ngModel)]="model.emergency_name" [ngModelOptions]="{standalone: true}" data-testid="sd-emname"></div>
        <div class="col-md-3"><label class="form-label">Emergency phone</label><input class="form-control" maxlength="20" [(ngModel)]="model.emergency_phone" [ngModelOptions]="{standalone: true}" data-testid="sd-emphone"></div>
        <div class="col-12" *ngIf="pharmacist">
            <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" role="switch" id="sd-is-pharmacist" [(ngModel)]="model.is_pharmacist" [ngModelOptions]="{standalone: true}" data-testid="sd-is-pharmacist">
                <label class="form-check-label" for="sd-is-pharmacist">This person is the pharmacist <span class="text-muted small">(registration details below)</span></label>
            </div>
        </div>
        <ng-container *ngIf="pharmacist">
        <div class="col-md-3"><label class="form-label">Pharmacist registration no.</label><input class="form-control text-uppercase" maxlength="30" [(ngModel)]="model.pharmacist_reg_no" [ngModelOptions]="{standalone: true}" [disabled]="!model.is_pharmacist" data-testid="sd-reg"></div>
        <div class="col-md-5"><label class="form-label">Pharmacy council</label><input class="form-control" maxlength="60" [(ngModel)]="model.pharmacist_council" [ngModelOptions]="{standalone: true}" [disabled]="!model.is_pharmacist" placeholder="e.g. Tamil Nadu State Pharmacy Council" data-testid="sd-council"></div>
        <div class="col-md-3"><label class="form-label">Registration valid to</label><input type="date" class="form-control" [(ngModel)]="model.pharmacist_valid_to" [ngModelOptions]="{standalone: true}" [disabled]="!model.is_pharmacist" data-testid="sd-valid"></div>
        </ng-container>
    </div>`
})
export class StaffDetailsFieldsComponent {
    @Input() model:any = {};
    /** the registration part is offered only to people who work at a pharmacy store */
    @Input() pharmacist = true;
}

/** The fields to send, or null when there is nothing to save. Switching "is the pharmacist" off clears a registration that was kept. */
export function staffDetailsBody(m:any, pharmacistApplies = true):any|null {
    const text = (k:string) => (m?.[k] ?? '').toString().trim();
    const body:any = {
        designation: text('designation'), emergency_name: text('emergency_name'), emergency_phone: text('emergency_phone'),
    };
    if (text('join_date')) body.join_date = text('join_date');
    const pharmacist = pharmacistApplies && !!m?.is_pharmacist;
    // where it does not apply (an "other" store) the registration is left exactly as it is
    if (pharmacistApplies) {
        body.pharmacist_reg_no = pharmacist ? text('pharmacist_reg_no') : '';
        body.pharmacist_council = pharmacist ? text('pharmacist_council') : '';
        body.pharmacist_valid_to = pharmacist ? (text('pharmacist_valid_to') || null) : null;
    }
    const filled = !!(body.designation || body.emergency_name || body.emergency_phone || body.join_date || (pharmacist && body.pharmacist_reg_no));
    return filled || (pharmacistApplies && m?._hadRegistration) ? body : null;
}

export function blankStaffDetails():any {
    return { designation: '', join_date: '', emergency_name: '', emergency_phone: '', is_pharmacist: false, pharmacist_reg_no: '', pharmacist_council: '', pharmacist_valid_to: '', _hadRegistration: false };
}

/** The form model for a person already on record (the switch is on when a registration is kept). */
export function staffDetailsModel(d:any):any {
    return { ...blankStaffDetails(), designation: d?.designation || '', join_date: d?.join_date || '', emergency_name: d?.emergency_name || '', emergency_phone: d?.emergency_phone || '',
        is_pharmacist: !!d?.pharmacist_reg_no, _hadRegistration: !!d?.pharmacist_reg_no,
        pharmacist_reg_no: d?.pharmacist_reg_no || '', pharmacist_council: d?.pharmacist_council || '', pharmacist_valid_to: d?.pharmacist_valid_to || '' };
}
