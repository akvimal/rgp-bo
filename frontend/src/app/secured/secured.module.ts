import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { StoreModule } from "@ngrx/store";
import { NgxChartsModule } from "@swimlane/ngx-charts";
import { DialogModule } from "primeng/dialog";
import { ConfirmDialogModule } from "primeng/confirmdialog";
import { ConfirmationService } from "primeng/api";
import { AuthGuard } from "../@core/auth/auth.guard";
import { SharedModule } from "../shared/shared.module";
import { ConfirmService } from "../shared/confirm.service";
import { CustomersModule } from "./customers/customers.module";
import { DashboardComponent } from "./dashboard.component";
import { DocumentsModule } from "./documents/documents.module";
import { ProductsModule } from "./products/products.module";
import { ProfileComponent } from "./profile.component";
import { PurchasesModule } from "./purchases/purchases.module";
import { SalesModule } from "./sales/sales.module";
import { SecuredComponent } from "./secured.component";

const routes: Routes = [
  { path: '', component: SecuredComponent, children: [
    { path: 'dashboard', canActivate:[AuthGuard], component: DashboardComponent },
    { path: 'profile', canActivate:[AuthGuard], component: ProfileComponent },
    {
      path: 'products', canActivate:[AuthGuard],
      loadChildren: () => import('./products/products.module').then(m => m.ProductsModule)
    },
    {
      path: 'vendors', canActivate:[AuthGuard],
      loadChildren: () => import('./purchases/vendors/vendors.module').then(m => m.VendorsModule)
    },
    {
      path: 'purchases', canActivate:[AuthGuard],
      loadChildren: () => import('./purchases/purchases.module').then(m => m.PurchasesModule)
    },
    {
      path: 'store', canActivate:[AuthGuard],
      loadChildren: () => import('./store/store.module').then(m => m.StoreModule)
    },
    {
      path: 'customers', canActivate:[AuthGuard],
      loadChildren: () => import('./customers/customers.module').then(m => m.CustomersModule)
    },
    {
      path: 'sales', canActivate:[AuthGuard],
      loadChildren: () => import('./sales/sales.module').then(m => m.SalesModule)
    },
    {
      path: 'reports', canActivate:[AuthGuard],
      loadChildren: () => import('./reports/reports.module').then(m => m.ReportsModule)
    },
    {
      path: 'quality', canActivate:[AuthGuard],
      loadChildren: () => import('./quality/quality.module').then(m => m.QualityModule)
    },
    {
      path: 'my-hr', canActivate:[AuthGuard],
      loadChildren: () => import('./my-hr/my-hr.module').then(m => m.MyHrModule)
    },
    {
      path: 'leave-approvals', canActivate:[AuthGuard],
      loadChildren: () => import('./leave-approvals/leave-approvals.module').then(m => m.LeaveApprovalsModule)
    },
    {
      path: 'vendor-issues', canActivate:[AuthGuard],
      loadChildren: () => import('./vendor-issues/vendor-issues.module').then(m => m.VendorIssuesModule)
    },
    {
      path: 'digital-payments', canActivate:[AuthGuard],
      loadChildren: () => import('./digital-payments/digital-payments.module').then(m => m.DigitalPaymentsModule)
    },{
      path: 'stock-audits', canActivate:[AuthGuard],
      loadChildren: () => import('./stock-audits/stock-audits.module').then(m => m.StockAuditsModule)
    },
    {
      path: 'shift', canActivate:[AuthGuard],
      loadChildren: () => import('./shift/shift.module').then(m => m.ShiftModule)
    },
    {
      path: 'inquiries', canActivate:[AuthGuard],
      loadChildren: () => import('./inquiries/inquiries.module').then(m => m.InquiriesModule)
    },
    {
      path: 'kpi', canActivate:[AuthGuard],
      loadChildren: () => import('./kpi/kpi.module').then(m => m.KpiModule)
    },
    {
      path: 'expenses', canActivate:[AuthGuard],
      loadChildren: () => import('./expenses/expenses.module').then(m => m.ExpensesModule)
    },
    {
      path: 'hr', canActivate:[AuthGuard],
      loadChildren: () => import('./hr/hr.module').then(m => m.HrModule)
    },
    {
      path: 'settings', canActivate:[AuthGuard],
      loadChildren: () => import('./settings/settings.module').then(m => m.SettingsModule)
    }
  ] }
];

@NgModule({
    declarations: [
      SecuredComponent,
      DashboardComponent,
      ProfileComponent
    ],
    imports: [
        RouterModule.forChild(routes),
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        SharedModule,
        NgxChartsModule,
        ProductsModule,
        PurchasesModule,
        StoreModule,
        CustomersModule,
        SalesModule,
        DocumentsModule,
        DialogModule,
        ConfirmDialogModule
    ],
    providers: [ConfirmationService, ConfirmService],
    exports: [RouterModule]
  })
export class SecuredModule{}
