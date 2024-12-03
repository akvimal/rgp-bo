import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { StoreModule } from "@ngrx/store";
import { NgxChartsModule } from "@swimlane/ngx-charts";
import { DialogModule } from "primeng/dialog";
import { AuthGuard } from "../@core/auth/auth.guard";
import { SharedModule } from "../shared/shared.module";
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
        DialogModule
    ],
    exports: [RouterModule]
  })
export class SecuredModule{}