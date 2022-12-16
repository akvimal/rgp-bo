import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { IsAuthDirective } from "./isauth.directive";

@NgModule({
    declarations: [
      IsAuthDirective
    ],
    imports: [
        CommonModule
    ],
    exports: [IsAuthDirective]
  })
export class SharedModule{}