import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { AutoCompleteModule } from "primeng/autocomplete";
import { MultiSelectModule } from 'primeng/multiselect';
import { CustomerSelectComponent } from "./components/customer-select.component";
import { LookupComponent } from "./components/lookup.component";
import { ProductSelectComponent } from "./components/product-select.component";
import { PropsPrintComponent } from "./components/props-print.component";
import { StockSelectComponent } from "./components/stock-select.component";
import { IsAuthDirective } from "./isauth.directive";
import { IsNavAuthDirective } from "./isNavAuth.directive";
import { TextWrapPipe } from "./text-wrap.pipe";

@NgModule({
    declarations: [
      ProductSelectComponent,
      StockSelectComponent,
      CustomerSelectComponent,
      IsNavAuthDirective,
      IsAuthDirective,
      TextWrapPipe,
      PropsPrintComponent,
      LookupComponent
    ],
    imports: [
        FormsModule,
        ReactiveFormsModule,
        CommonModule,
        AutoCompleteModule,
        MultiSelectModule
    ],
    exports: [IsAuthDirective,
      IsNavAuthDirective,
      TextWrapPipe, 
      ProductSelectComponent,
      StockSelectComponent,
      CustomerSelectComponent,PropsPrintComponent, LookupComponent
    ]
  })
export class SharedModule{}