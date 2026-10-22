import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { ExpensesShellComponent } from "./expenses-shell.component";
import { ExpenseListComponent } from "./expense-list.component";
import { ExpenseRecurringComponent } from "./expense-recurring.component";
import { ExpenseReportComponent } from "./expense-report.component";
import { ExpenseSetupComponent } from "./expense-setup.component";

const routes: Routes = [
  { path: "", component: ExpensesShellComponent, children: [
    { path: "", redirectTo: "list", pathMatch: "full" },
    { path: "list", component: ExpenseListComponent, canActivate: [AuthGuard] },
    { path: "recurring", component: ExpenseRecurringComponent, canActivate: [AuthGuard] },
    { path: "report", component: ExpenseReportComponent, canActivate: [AuthGuard] },
    { path: "setup", component: ExpenseSetupComponent, canActivate: [AuthGuard] },
  ]},
];

/** Business- and store-level expenses with approval, recurring entries and a report. */
@NgModule({
  declarations: [ExpensesShellComponent, ExpenseListComponent, ExpenseRecurringComponent, ExpenseReportComponent, ExpenseSetupComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class ExpensesModule {}
