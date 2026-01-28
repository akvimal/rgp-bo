import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { AutoCompleteModule } from "primeng/autocomplete";
import { MultiSelectModule } from 'primeng/multiselect';
import { DialogModule } from 'primeng/dialog';
import { CustomerSelectComponent } from "./components/customer-select.component";
import { BugReportFabComponent } from "./components/bug-report-fab.component";
import { BugReportDialogComponent } from "./components/bug-report-dialog.component";
import { LookupComponent } from "./components/lookup.component";
import { PasswordStrengthIndicatorComponent } from "./components/password-strength-indicator.component";
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
      PasswordStrengthIndicatorComponent,
      IsNavAuthDirective,
      IsAuthDirective,
      TextWrapPipe,
      PropsPrintComponent,
      LookupComponent,
      BugReportFabComponent,
      BugReportDialogComponent
    ],
    imports: [
        FormsModule,
        ReactiveFormsModule,
        CommonModule,
        AutoCompleteModule,
        MultiSelectModule,
        DialogModule
    ],
    exports: [IsAuthDirective,
      IsNavAuthDirective,
      TextWrapPipe,
      ProductSelectComponent,
      StockSelectComponent,
      CustomerSelectComponent,
      PasswordStrengthIndicatorComponent,
      PropsPrintComponent,
      LookupComponent,
      BugReportFabComponent,
      BugReportDialogComponent
    ]
  })
export class SharedModule{}