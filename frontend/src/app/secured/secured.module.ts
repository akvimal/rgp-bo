import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { NgxChartsModule } from "@swimlane/ngx-charts";
import { AuthGuard } from "../@core/auth/auth.guard";
import { CustInquiryComponent } from "../custinquiry.component";
import { SharedModule } from "../shared/shared.module";
import { CustomersModule } from "./customers/customers.module";
import { DashboardComponent } from "./dashboard.component";
import { ProductsModule } from "./products/products.module";
import { ProfileComponent } from "./profile.component";
import { PurchasesModule } from "./purchases/purchases.module";
import { RolesModule } from "./roles/roles.module";
import { SalesModule } from "./sales/sales.module";
import { SecuredComponent } from "./secured.component";
import { UsersModule } from "./users/users.module";

const routes: Routes = [
  { path: '', component: SecuredComponent, children: [
    { path: 'dashboard', canActivate:[AuthGuard], component: DashboardComponent },
    { path: 'profile', canActivate:[AuthGuard], component: ProfileComponent },

  { path: 'custinquiry', component: CustInquiryComponent },
    {
      path: 'roles', canActivate:[AuthGuard],
      loadChildren: () => import('./roles/roles.module').then(m => m.RolesModule)
    },
    {
      path: 'users', canActivate:[AuthGuard],
      loadChildren: () => import('./users/users.module').then(m => m.UsersModule)
    },
    {
      path: 'products', canActivate:[AuthGuard],
      loadChildren: () => import('./products/products.module').then(m => m.ProductsModule)
    },
    {
      path: 'vendors', canActivate:[AuthGuard],
      loadChildren: () => import('./vendors/vendors.module').then(m => m.VendorsModule)
    },
    {
      path: 'purchases', canActivate:[AuthGuard],
      loadChildren: () => import('./purchases/purchases.module').then(m => m.PurchasesModule)
    },
    {
      path: 'customers', canActivate:[AuthGuard],
      loadChildren: () => import('./customers/customers.module').then(m => m.CustomersModule)
    },
    {
      path: 'sales', canActivate:[AuthGuard],
      loadChildren: () => import('./sales/sales.module').then(m => m.SalesModule)
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
        RolesModule,
        UsersModule,
        ProductsModule,
        PurchasesModule,
        CustomersModule,
        SalesModule
    ],
    exports: [RouterModule]
  })
export class SecuredModule{}