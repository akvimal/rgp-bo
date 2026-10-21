import { Component, Input } from "@angular/core";

/**
 * The page title and, on the right, the page's actions (the primary "Add" button first on the right).
 *
 *   <app-page-header title="Customers" subtitle="optional one-liner">
 *     <div actions> <a class="btn btn-primary" ...>Add New</a> </div>
 *   </app-page-header>
 *
 * Pages that sit under a titled section (Products, Purchase, Settings ...) keep the section's title and use
 * <div class="page-toolbar"> instead: filters on the left, the primary action on the right.
 */
@Component({
    selector: 'app-page-header',
    template: `
    <div class="page-header">
        <div class="page-header-text">
            <h1>{{title}}</h1>
            <p class="page-subtitle" *ngIf="subtitle">{{subtitle}}</p>
        </div>
        <div class="page-header-actions"><ng-content select="[actions]"></ng-content></div>
    </div>`
})
export class PageHeaderComponent {
    @Input() title = '';
    @Input() subtitle = '';
}
