import { Component } from "@angular/core";

/** GST for the Business Head: the registration, rate changes, HSN, the sales register and the monthly summary. */
@Component({
  template: `
  <div class="pagetitle"><h1>GST</h1></div>
  <ul class="nav nav-pills mb-3" data-testid="gst-tabs">
    <li class="nav-item" *ngFor="let t of tabs"><a class="nav-link" [class.active]="tab === t.key" role="button" (click)="tab = t.key" [attr.data-testid]="'gst-tab-' + t.key">{{t.label}}</a></li>
  </ul>
  <app-gst-registration *ngIf="tab === 'registration'"></app-gst-registration>
  <app-gst-register *ngIf="tab === 'register'"></app-gst-register>
  <app-gst-summary *ngIf="tab === 'summary'"></app-gst-summary>
  <app-gst-rates *ngIf="tab === 'rates'"></app-gst-rates>
  <app-gst-hsn *ngIf="tab === 'hsn'"></app-gst-hsn>
  `,
})
export class GstComponent {
  tabs = [
    { key: 'registration', label: 'Registration' },
    { key: 'register', label: 'Sales register' },
    { key: 'summary', label: 'Monthly summary' },
    { key: 'rates', label: 'Rate changes' },
    { key: 'hsn', label: 'HSN codes' },
  ];
  tab = 'registration';
}
