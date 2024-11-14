import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AutoCompleteModule } from "primeng/autocomplete";
import { ProductSelectComponent } from "./components/product-select.component";
import { IsAuthDirective } from "./isauth.directive";
import { IsNavAuthDirective } from "./isNavAuth.directive";

@NgModule({
    declarations: [
      ProductSelectComponent,
      IsNavAuthDirective,
      IsAuthDirective
    ],
    imports: [
        FormsModule,
        CommonModule,
        AutoCompleteModule
    ],
    exports: [IsAuthDirective,IsNavAuthDirective,ProductSelectComponent]
  })
export class SharedModule{}