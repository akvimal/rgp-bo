import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AutoCompleteModule } from "primeng/autocomplete";
import { ProductLookupComponent } from "./components/product-lookup.component";
import { IsAuthDirective } from "./isauth.directive";

@NgModule({
    declarations: [
      ProductLookupComponent,
      IsAuthDirective
    ],
    imports: [
        FormsModule,
        CommonModule,
        AutoCompleteModule
    ],
    exports: [IsAuthDirective,ProductLookupComponent]
  })
export class SharedModule{}