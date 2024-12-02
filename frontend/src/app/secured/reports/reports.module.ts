import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { TableModule } from "primeng/table";
import { AuthGuard } from "src/app/@core/auth/auth.guard";
import { SharedModule } from "src/app/shared/shared.module";
import { DocumentsModule } from "../documents/documents.module";
import { ReportsComponent } from "./components/reports.component";

const routes: Routes = [
  { path: '', component: ReportsComponent, canActivate:[AuthGuard]}
];

@NgModule({
    declarations: [
      ReportsComponent
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