import { PriceUnitsComponent } from './components/price-units.component';
import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { AutoCompleteModule } from "primeng/autocomplete";
import { MultiSelectModule } from 'primeng/multiselect';
import { SidebarModule } from "primeng/sidebar";
import { PeekComponent } from "./components/peek.component";
import { SectionComponent } from "./components/section.component";
import { DialogStandardDirective } from "./dialog-standard.directive";
import { RowActionsComponent } from "./components/row-actions.component";
import { InViewDirective } from "./in-view.directive";
import { CustomerSelectComponent } from "./components/customer-select.component";
import { DenominationGridComponent } from "./components/denomination-grid.component";
import { PageHeaderComponent } from "./components/page-header.component";
import { NeedsStripComponent } from "./components/needs-strip.component";
import { DashHeaderComponent } from "./components/dash-header.component";
import { LookupComponent } from "./components/lookup.component";
import { InsightTableComponent } from "./components/insight-table.component";
import { BuyingBriefComponent } from "./components/buying-brief.component";
import { ProductSelectComponent } from "./components/product-select.component";
import { PropsPrintComponent } from "./components/props-print.component";
import { StockSelectComponent } from "./components/stock-select.component";
import { IsAuthDirective } from "./isauth.directive";
import { IsNavAuthDirective } from "./isNavAuth.directive";
import { TextWrapPipe } from "./text-wrap.pipe";
import { TermPipe } from "./label.service";

@NgModule({
    declarations: [
      PriceUnitsComponent,
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
      DashHeaderComponent,
      InsightTableComponent,
      BuyingBriefComponent,
      PeekComponent,
      SectionComponent,
      DialogStandardDirective,
      RowActionsComponent,
      InViewDirective
    ],
    imports: [
        FormsModule,
        ReactiveFormsModule,
        CommonModule,
        AutoCompleteModule,
        MultiSelectModule,
        SidebarModule,
        RouterModule
    ],
    exports: [PriceUnitsComponent,
      IsAuthDirective,
      IsNavAuthDirective,
      TextWrapPipe, 
      TermPipe,
      ProductSelectComponent,
      StockSelectComponent,
      CustomerSelectComponent,PropsPrintComponent, LookupComponent,
      DenominationGridComponent,
      PageHeaderComponent,
      NeedsStripComponent,
      DashHeaderComponent,
      InsightTableComponent,
      BuyingBriefComponent,
      PeekComponent,
      SectionComponent,
      DialogStandardDirective,
      RowActionsComponent,
      InViewDirective
    ]
  })
export class SharedModule{}