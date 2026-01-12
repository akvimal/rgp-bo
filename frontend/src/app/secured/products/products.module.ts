import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "src/app/@core/auth/auth.guard";
import { SharedModule } from "src/app/shared/shared.module";
import {TableModule} from 'primeng/table';
import {ToastModule} from 'primeng/toast';
import {CalendarModule} from 'primeng/calendar';
import {SliderModule} from 'primeng/slider';
import {MultiSelectModule} from 'primeng/multiselect';
import {ContextMenuModule} from 'primeng/contextmenu';
import {DialogModule} from 'primeng/dialog';
import {ButtonModule} from 'primeng/button';
import {DropdownModule} from 'primeng/dropdown';
import {ProgressBarModule} from 'primeng/progressbar';
import {InputTextModule} from 'primeng/inputtext';
import { ProductPriceComponent } from "./components/price/product-price.component";
import { ProductListComponent } from "./components/master/product-list.component";
import { ProductFormComponent } from "./components/master/product-form.component";
import { ProductsComponent } from "./components/products.component";
import { ProductHeaderComponent } from "./components/product-header.component";
import { ConfirmDialogModule } from "primeng/confirmdialog";
import { DocumentsModule } from "../documents/documents.module";
import { ProductPriceChangeComponent } from "./components/price/product-price-change.component";
import { PriceAdjustorComponent } from "./components/price/price-adjustor.component";
import { PriceEstimatorComponent } from "./components/price/price-estimator.component";
import { PricingBreakdownComponent } from "./components/pricing-breakdown.component";
import { HsnListComponent } from "./hsn/hsn-list.component";
import { HsnFormComponent } from "./hsn/hsn-form.component";

const routes: Routes = [
  { path: '', component: ProductsComponent,
    children: [
      { path: '', redirectTo: 'master'},
      { path: 'master', children: [
        { path: '', redirectTo: 'list'},
        { path: 'list', component: ProductListComponent, canActivate:[AuthGuard]},
        { path: 'new', component: ProductFormComponent, canActivate:[AuthGuard]},
        { path: 'edit/:id', component: ProductFormComponent, canActivate:[AuthGuard]}
      ]},
      { path: 'price', component: ProductPriceComponent, canActivate:[AuthGuard]},
      { path: 'hsn', children: [
        { path: '', component: HsnListComponent, canActivate:[AuthGuard]},
        { path: 'new', component: HsnFormComponent, canActivate:[AuthGuard]},
        { path: 'edit/:id', component: HsnFormComponent, canActivate:[AuthGuard]}
      ]}
  ]},

];

@NgModule({
    declarations: [
        ProductsComponent,
        ProductHeaderComponent,
        ProductListComponent,
        ProductFormComponent,
        ProductPriceComponent,
        ProductPriceChangeComponent,
        PriceAdjustorComponent,
        PriceEstimatorComponent,
        PricingBreakdownComponent,
        HsnListComponent,
        HsnFormComponent
    ],
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        TableModule,ToastModule,
        CalendarModule,
        SliderModule,
        MultiSelectModule,
        ContextMenuModule,
        DialogModule,
        ConfirmDialogModule,
        ButtonModule,
        DropdownModule,
        ProgressBarModule,
        InputTextModule,
        RouterModule.forChild(routes),
        SharedModule,
        DocumentsModule
    ],
    exports: [RouterModule, PriceEstimatorComponent, PricingBreakdownComponent]
  })
export class ProductsModule{}