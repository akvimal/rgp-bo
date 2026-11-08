import { Component, Input } from "@angular/core";

/** A plain table for the answer to a question: columns say whether a value is money, a number, a per cent or a date. */
@Component({
  selector: "app2-insight-table",
  template: `
    <div class="table-responsive">
      <table class="table table-sm align-middle small mb-0" data-testid="it-table">
        <thead><tr><th *ngFor="let c of columns" [class.text-end]="isNum(c)">{{c.label}}</th></tr></thead>
        <tbody>
          <tr *ngFor="let r of rows">
            <td *ngFor="let c of columns" [class.text-end]="isNum(c)">
              <ng-container [ngSwitch]="c.type">
                <span *ngSwitchCase="'money'">&#8377;{{r[c.key] | number:'1.0-0'}}</span>
                <span *ngSwitchCase="'number'">{{r[c.key] | number:'1.0-2'}}</span>
                <span *ngSwitchCase="'percent'">{{r[c.key] | number:'1.0-1'}}%</span>
                <span *ngSwitchDefault>{{r[c.key]}}</span>
              </ng-container>
            </td>
          </tr>
          <tr *ngIf="!rows.length"><td [attr.colspan]="columns.length" class="text-center text-muted py-3" data-testid="it-empty">Nothing to show for this.</td></tr>
        </tbody>
      </table>
    </div>`,
})
export class InsightTableComponent {
  @Input() columns: { key: string; label: string; type: string }[] = [];
  @Input() rows: any[] = [];

  isNum(c: { type: string }) { return c.type === "money" || c.type === "number" || c.type === "percent"; }
}
