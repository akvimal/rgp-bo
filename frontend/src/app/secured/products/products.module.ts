import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "src/app/@core/auth/auth.guard";
import { SharedModule } from "src/app/shared/shared.module";
import { ProductFormComponent } from "./components/product-form.component";
import { ProductListComponent } from "./components/product-list.component";
import { ProductsComponent } from "./components/products.component";
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
import { ProductHeaderComponent } from "./components/product-header.component";
import { ProductPriceComponent } from "./components/product-price.component";

const routes: Routes = [
  { path: '', redirectTo: 'list'},
  {path: 'list', component: ProductListComponent, canActivate:[AuthGuard]},
  {path: 'price', component: ProductPriceComponent, canActivate:[AuthGuard]},
    {path: 'new', component: ProductFormComponent, canActivate:[AuthGuard]},
    {path: 'edit/:id', component: ProductFormComponent, canActivate:[AuthGuard]}
];

@NgModule({
    declarations: [
        ProductsComponent,
        ProductListComponent,
        ProductFormComponent,
        ProductHeaderComponent,
        ProductPriceComponent
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
        ButtonModule,
        DropdownModule,
        ProgressBarModule,
        InputTextModule,
        RouterModule.forChild(routes),
        SharedModule
    ],
    exports: [RouterModule]
  })
export class ProductsModule{}