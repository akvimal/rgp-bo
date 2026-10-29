import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { AutoCompleteModule } from "primeng/autocomplete";
import { MultiSelectModule } from 'primeng/multiselect';
import { CustomerSelectComponent } from "./components/customer-select.component";
import { DenominationGridComponent } from "./components/denomination-grid.component";
import { PageHeaderComponent } from "./components/page-header.component";
import { NeedsStripComponent } from "./components/needs-strip.component";
import { DashHeaderComponent } from "./components/dash-header.component";
import { LookupComponent } from "./components/lookup.component";
import { ProductSelectComponent } from "./components/product-select.component";
import { PropsPrintComponent } from "./components/props-print.component";
import { StockSelectComponent } from "./components/stock-select.component";
import { IsAuthDirective } from "./isauth.directive";
import { IsNavAuthDirective } from "./isNavAuth.directive";
import { TextWrapPipe } from "./text-wrap.pipe";
import { TermPipe } from "./label.service";

@NgModule({
    declarations: [
      ProductSelectComponent,
      StockSelectComponent,
      CustomerSelectComponent,
      IsNavAuthDirective,
      IsAuthDirective,
      TextWrapPipe,
      TermPipe,
      PropsPrintComponent,
      LookupComponent,
      DenominationGridComponent,
      PageHeaderComponent,
      NeedsStripComponent,
      DashHeaderComponent
    ],
    imports: [
        FormsModule,
        ReactiveFormsModule,
        CommonModule,
        AutoCompleteModule,
        MultiSelectModule,
        RouterModule
    ],
    exports: [IsAuthDirective,
      IsNavAuthDirective,
      TextWrapPipe, 
      TermPipe,
      ProductSelectComponent,
      StockSelectComponent,
      CustomerSelectComponent,PropsPrintComponent, LookupComponent,
      DenominationGridComponent,
      PageHeaderComponent,
      NeedsStripComponent,
      DashHeaderComponent
    ]
  })
export class SharedModule{}