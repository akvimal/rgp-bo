import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "src/app/@core/auth/auth.guard";
import { SharedModule } from "src/app/shared/shared.module";
import { AutoCompleteModule } from 'primeng/autocomplete';
import { DialogModule} from 'primeng/dialog';
import {TableModule} from 'primeng/table';
import {ToastModule} from 'primeng/toast';
import {CalendarModule} from 'primeng/calendar';
import {SliderModule} from 'primeng/slider';
import {MultiSelectModule} from 'primeng/multiselect';
import {ContextMenuModule} from 'primeng/contextmenu';
import {ButtonModule} from 'primeng/button';
import {MenuModule} from 'primeng/menu';

import {DropdownModule} from 'primeng/dropdown';
import { TabViewModule } from 'primeng/tabview';
import {ProgressBarModule} from 'primeng/progressbar';
import {InputTextModule} from 'primeng/inputtext';
import { StoreComponent } from "./store.component";
import { CashComponent } from "./cash/components/cash.component";
import { ShiftsComponent } from "./shifts/components/shifts.component";
import { StockAdjustComponent } from "./stock/components/stock-adjust.component";
import { StockProductsComponent } from "./stock/components/stock-products.component";
import { StockProductItemsComponent } from "./stock/components/stock-product-items.component";
import { StockAdjustFormComponent } from "./stock/components/stock-adjust-form.component";
import { StockComponent } from "./stock/components/stock.component";
import { StockExpiryComponent } from "./stock/components/stock-expiry.component";
import { DisposalListComponent } from "./stock/components/disposal-list.component";
import { DisposalDetailComponent } from "./stock/components/disposal-detail.component";
import { StockCountComponent } from "./stock/components/stock-count.component";
import { TransfersComponent } from "./transfers/components/transfers.component";
import { VaultComponent } from "./vault/vault.component";

const routes: Routes = [
  { path: '', component: StoreComponent, canActivate:[AuthGuard], children: [
    { path: '', redirectTo: 'stock' },
    { path: 'stock', component: StockComponent, children: [
        { path: '', redirectTo: 'products' },
        { path: 'products', component: StockProductsComponent, children: [{
            path: 'items/:id', component: StockProductItemsComponent
        }] },
        { path: 'expiry', component: StockExpiryComponent },
        { path: 'passes', component: DisposalListComponent },
        { path: 'passes/:id', component: DisposalDetailComponent },
        { path: 'adjust', component: StockAdjustComponent },
        { path: 'count', component: StockCountComponent }
      ] },
    { path: 'shifts', component: ShiftsComponent},
    { path: 'transfers', component: TransfersComponent},
    // superseded by the fuller Requests screen at /secure/purchases/requests (same
    // purchase_request data via PurchaseIntentService); kept as a redirect for old links.
    { path: 'intent', redirectTo: '/secure/purchases/requests', pathMatch: 'full' },
    { path: 'cash', component: CashComponent},
    { path: 'vault', component: VaultComponent}
  ]}
];

@NgModule({
    declarations: [
      StoreComponent,
      CashComponent,
      ShiftsComponent,
      StockComponent,
      StockAdjustComponent,
      StockProductsComponent,
      StockExpiryComponent,
      DisposalListComponent,
      DisposalDetailComponent,
      StockProductItemsComponent,
      StockAdjustFormComponent,
      StockCountComponent,
      TransfersComponent,
      VaultComponent
    ],
    imports: [
        RouterModule.forChild(routes),
        FormsModule,  
        CommonModule,
        ReactiveFormsModule,
        AutoCompleteModule,
        CalendarModule,
        DialogModule,
        TableModule,
        ToastModule,
        MenuModule,
        TabViewModule,
        SliderModule,
        MultiSelectModule,
        ContextMenuModule,
        ButtonModule,
        DropdownModule,
        ProgressBarModule,
        InputTextModule,
        SharedModule
    ],
    exports: [RouterModule]
  })
export class StoreModule{}
