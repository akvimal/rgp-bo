import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { TableModule } from "primeng/table";
import { AuthGuard } from "src/app/@core/auth/auth.guard";
import { ReportsAccessGuard } from "./reports-access.guard";
import { SharedModule } from "src/app/shared/shared.module";
import { DocumentsModule } from "../documents/documents.module";
import { ReportsTabsComponent } from "./components/reports-tabs.component";
import { AskShopComponent } from "./components/ask-shop.component";
import { WeeklySummaryComponent } from "./components/weekly-summary.component";
import { ReportsHubComponent } from "./components/reports-hub.component";

const routes: Routes = [
  { path: '', component: ReportsHubComponent, canActivate:[AuthGuard, ReportsAccessGuard], data: { needs: 'hub' }},
  { path: 'ask', component: AskShopComponent, canActivate:[AuthGuard, ReportsAccessGuard], data: { needs: 'reports.ask' }},
  { path: 'weekly', component: WeeklySummaryComponent, canActivate:[AuthGuard, ReportsAccessGuard], data: { needs: 'reports.margin' }}
];

@NgModule({
    declarations: [
      ReportsTabsComponent,
      AskShopComponent,
      WeeklySummaryComponent,
      ReportsHubComponent
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