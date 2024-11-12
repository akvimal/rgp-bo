import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { NgxChartsModule } from "@swimlane/ngx-charts";
import { AuthGuard } from "../@core/auth/auth.guard";
import { SharedModule } from "../shared/shared.module";
import { CustomersModule } from "./customers/customers.module";
import { DashboardComponent } from "./dashboard.component";
import { ProductsModule } from "./products/products.module";
import { ProfileComponent } from "./profile.component";
import { PurchasesModule } from "./purchases/purchases.module";
import { SalesModule } from "./sales/sales.module";
import { SecuredComponent } from "./secured.component";
import { StockModule } from "./stock/stock.module";

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
      path: 'stock', canActivate:[AuthGuard],
      loadChildren: () => import('./stock/stock.module').then(m => m.StockModule)
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
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        RouterModule.forChild(routes),
        SharedModule,
        NgxChartsModule,
        ProductsModule,
        PurchasesModule,
        StockModule,
        CustomersModule,
        SalesModule
    ],
    exports: [RouterModule]
  })
export class SecuredModule{}