import { Component, OnInit } from "@angular/core";
import { AuthService } from "src/app/@core/auth/auth.service";
import { ConfirmService } from "src/app/shared/confirm.service";

/** Settings > Stores > Store PCs: register the PC you are on, choose its Counter login, revoke a PC, and say who may skip the authenticator on one */
@Component({
  selector: 'app-store-pcs',
  template: `
<div class="mt-3" data-testid="store-pcs-panel">
  <p class="text-muted small mb-3">
    A registered store PC can skip the authenticator code (the password is still asked) and can sign the store's Counter login in on its own.
    Register the PC you are sitting at while you are signed in with your own password and code.
  </p>

  <div class="alert alert-danger py-2" role="alert" *ngIf="error" data-testid="store-pcs-error">{{error}}</div>
  <div class="alert alert-success py-2" role="status" *ngIf="message" data-testid="store-pcs-message">{{message}}</div>

  <div class="border rounded p-3 mb-3" *ngIf="data?.canSetMode" data-testid="store-pcs-mode">
    <label class="form-label fw-bold mb-1" for="pcmode">Who may skip the authenticator on a registered PC</label>
    <select id="pcmode" class="form-select w-auto" [ngModel]="data.mode" (ngModelChange)="setMode($event)" data-testid="store-pcs-mode-select">
      <option value="off">Nobody (a registered PC changes nothing)</option>
      <option value="counter">Counter logins only</option>
      <option value="all">Everyone except owners</option>
    </select>
    <div class="form-text">Business Heads and Owner-operators always use the authenticator. "Nobody" also stops automatic Counter sign-in.</div>
  </div>

  <div class="border rounded p-3 mb-3" data-testid="store-pcs-register">
    <div class="fw-bold mb-2">Register this PC</div>
    <div class="row g-2 align-items-end">
      <div class="col-12 col-md-4">
        <label class="form-label small mb-0" for="pcname">Name</label>
        <input id="pcname" class="form-control" [(ngModel)]="form.name" placeholder="Billing counter 1" maxlength="120" data-testid="store-pcs-name">
      </div>
      <div class="col-6 col-md-3">
        <label class="form-label small mb-0" for="pcstore">Store</label>
        <select id="pcstore" class="form-select" [(ngModel)]="form.storeid" data-testid="store-pcs-store">
          <option *ngFor="let s of data?.stores" [ngValue]="s.id">{{s.name}}</option>
        </select>
      </div>
      <div class="col-6 col-md-3">
        <label class="form-label small mb-0" for="pccounter">Counter login that signs in by itself</label>
        <select id="pccounter" class="form-select" [(ngModel)]="form.counteruserid" data-testid="store-pcs-counter">
          <option [ngValue]="null">None</option>
          <option *ngFor="let u of data?.counterUsers" [ngValue]="u.id">{{u.name || u.email}}</option>
        </select>
      </div>
      <div class="col-12 col-md-2 d-grid">
        <button class="btn btn-primary" (click)="register()" [disabled]="busy || !form.name || !form.storeid" data-testid="store-pcs-register-btn">Register</button>
      </div>
    </div>
    <div class="small text-muted mt-2" *ngIf="thisPc">This browser is already registered as <b>{{thisPc}}</b>.</div>
  </div>

  <div class="table-responsive">
    <table class="table table-sm align-middle" data-testid="store-pcs-table">
      <thead><tr><th>PC</th><th>Store</th><th>Counter login</th><th>Last seen</th><th></th></tr></thead>
      <tbody>
        <tr *ngFor="let d of data?.devices" [class.text-muted]="!d.active" [attr.data-testid]="'store-pcs-row-' + d.id">
          <td>{{d.name}} <span class="badge bg-secondary ms-1" *ngIf="!d.active">revoked</span></td>
          <td>{{d.storename}}</td>
          <td>
            <select *ngIf="d.active" class="form-select form-select-sm w-auto" [ngModel]="d.counteruserid" (ngModelChange)="link(d, $event)">
              <option [ngValue]="null">None</option>
              <option *ngFor="let u of data?.counterUsers" [ngValue]="u.id">{{u.name || u.email}}</option>
            </select>
            <span *ngIf="!d.active">{{d.counteremail || '-'}}</span>
          </td>
          <td>{{d.lastseen ? (d.lastseen | date:'dd MMM, HH:mm') : '-'}}</td>
          <td class="text-end"><button *ngIf="d.active" class="btn btn-sm btn-outline-danger" (click)="revoke(d)" [attr.data-testid]="'store-pcs-revoke-' + d.id">Revoke</button></td>
        </tr>
        <tr *ngIf="data && !data.devices.length"><td colspan="5" class="text-muted">No store PC is registered yet.</td></tr>
      </tbody>
    </table>
  </div>
</div>`
})
export class StorePcsComponent implements OnInit {
  data: any = null;
  form: any = { name: '', storeid: null, counteruserid: null };
  busy = false;
  error = '';
  message = '';
  thisPc = '';

  constructor(private auth: AuthService, private confirm: ConfirmService) {}

  ngOnInit() {
    this.load();
    this.auth.deviceStatus().subscribe({ next: (s: any) => this.thisPc = s?.registered ? s.name : '', error: () => {} });
  }

  private fail(err: any, fallback: string) {
    this.busy = false;
    this.message = '';
    const m = err?.error?.message;
    this.error = (Array.isArray(m) ? m.join(' ') : m) || fallback;
  }

  load() {
    this.auth.devices().subscribe({
      next: (d: any) => {
        this.data = d;
        if (!this.form.storeid && d.stores?.length) this.form.storeid = d.stores[0].id;
      },
      error: (e) => this.fail(e, 'Could not load the store PCs.')
    });
  }

  register() {
    this.busy = true; this.error = ''; this.message = '';
    this.auth.registerDevice({ ...this.form, name: String(this.form.name).trim() }).subscribe({
      next: (r: any) => {
        this.auth.setDeviceToken(r.token);
        this.busy = false;
        this.message = `This PC is registered as "${r.name}".`;
        this.thisPc = r.name;
        this.form.name = '';
        this.load();
      },
      error: (e) => this.fail(e, 'Could not register this PC.')
    });
  }

  link(d: any, counteruserid: number | null) {
    this.error = ''; this.message = '';
    this.auth.linkDeviceCounter(d.id, counteruserid).subscribe({
      next: () => { d.counteruserid = counteruserid; this.message = 'Saved.'; },
      error: (e) => { this.fail(e, 'Could not save.'); this.load(); }
    });
  }

  setMode(mode: string) {
    this.error = ''; this.message = '';
    this.auth.setDeviceMode(mode).subscribe({
      next: () => { this.data.mode = mode; this.message = 'Saved.'; },
      error: (e) => { this.fail(e, 'Could not save.'); this.load(); }
    });
  }

  revoke(d: any) {
    this.confirm.confirmDelete(d.name, () => {
      this.auth.revokeDevice(d.id).subscribe({
        next: () => { this.message = `"${d.name}" is revoked.`; this.load(); },
        error: (e) => this.fail(e, 'Could not revoke.')
      });
    }, { entity: 'store PC', verb: 'Revoke', consequence: 'Anyone signed in on it is signed out, and it must be registered again to be trusted.', reversible: true });
  }
}
