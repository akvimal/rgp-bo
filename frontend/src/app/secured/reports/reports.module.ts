import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { TableModule } from "primeng/table";
import { AuthGuard } from "src/app/@core/auth/auth.guard";
import { SharedModule } from "src/app/shared/shared.module";
import { DocumentsModule } from "../documents/documents.module";
import { ReportsComponent } from "./components/reports.component";
import { ReportsTabsComponent } from "./components/reports-tabs.component";
import { AskShopComponent } from "./components/ask-shop.component";
import { WeeklySummaryComponent } from "./components/weekly-summary.component";

const routes: Routes = [
  { path: '', component: ReportsComponent, canActivate:[AuthGuard]},
  { path: 'ask', component: AskShopComponent, canActivate:[AuthGuard]},
  { path: 'weekly', component: WeeklySummaryComponent, canActivate:[AuthGuard]}
];

@NgModule({
    declarations: [
      ReportsComponent,
      ReportsTabsComponent,
      AskShopComponent,
      WeeklySummaryComponent
    ],
    imports: [
        RouterModule.forChild(routes),
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        TableModule,
        SharedModule,
        DocumentsModule
    ],
    exports: []
  })
export class ReportsModule{}