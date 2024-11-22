import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AutoCompleteModule } from "primeng/autocomplete";
import { CustomerSelectComponent } from "./components/customer-select.component";
import { ProductSelectComponent } from "./components/product-select.component";
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
      TextWrapPipe
    ],
    imports: [
        FormsModule,
        CommonModule,
        AutoCompleteModule
    ],
    exports: [IsAuthDirective,IsNavAuthDirective,TextWrapPipe, ProductSelectComponent,StockSelectComponent,CustomerSelectComponent]
  })
export class SharedModule{}