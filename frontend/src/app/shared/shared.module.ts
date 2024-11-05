import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AutoCompleteModule } from "primeng/autocomplete";
import { ProductLookupComponent } from "./components/product-lookup.component";
import { IsAuthDirective } from "./isauth.directive";
import { IsNavAuthDirective } from "./isNavAuth.directive";

@NgModule({
    declarations: [
      ProductLookupComponent,
      IsNavAuthDirective,
      IsAuthDirective
    ],
    imports: [
        FormsModule,
        CommonModule,
        AutoCompleteModule
    ],
    exports: [IsAuthDirective,IsNavAuthDirective,ProductLookupComponent]
  })
export class SharedModule{}