import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "src/app/@core/auth/auth.guard";
import { SharedModule } from "src/app/shared/shared.module";
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { CalendarModule } from 'primeng/calendar';
import { SliderModule } from 'primeng/slider';
import { MultiSelectModule } from 'primeng/multiselect';
import { ContextMenuModule } from 'primeng/contextmenu';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { ProgressBarModule } from 'primeng/progressbar';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmDialogModule } from "primeng/confirmdialog";
import { PricingComponent } from "./pricing.component";
import { ProductPriceComponent } from "./components/product-price.component";
import { ProductPriceChangeComponent } from "./components/product-price-change.component";
import { PricingPolicyComponent } from "./components/pricing-policy.component";
import { PricingRulesComponent } from "./components/pricing-rules.component";
import { PriceCompareComponent } from "./components/price-compare.component";

const routes: Routes = [
  { path: '', component: PricingComponent, children: [
    { path: 'prices', component: ProductPriceComponent, canActivate: [AuthGuard] },
    { path: 'changes', canActivate: [AuthGuard], loadChildren: () => import('../price-changes/price-changes.module').then(m => m.PriceChangesModule) },
    { path: 'policy', component: PricingPolicyComponent, canActivate: [AuthGuard] },
    { path: 'rules', component: PricingRulesComponent, canActivate: [AuthGuard] },
    { path: 'compare', component: PriceCompareComponent, canActivate: [AuthGuard] },
  ]},
];

/** Pricing: prices, the price changes sheet, the pricing policy and the pricing rules. */
@NgModule({
  declarations: [PricingComponent, ProductPriceComponent, ProductPriceChangeComponent, PricingPolicyComponent, PricingRulesComponent, PriceCompareComponent],
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, TableModule, ToastModule, CalendarModule, SliderModule, MultiSelectModule, ContextMenuModule,
    DialogModule, ConfirmDialogModule, ButtonModule, DropdownModule, ProgressBarModule, InputTextModule,
    RouterModule.forChild(routes), SharedModule,
  ],
})
export class PricingModule {}
