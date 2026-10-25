import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { FinanceComponent } from "./finance.component";

const routes: Routes = [{ path: "", component: FinanceComponent, canActivate: [AuthGuard] }];

/**
 * Finance for the Business Head: income and expenses, bank statements from any bank, the books against the bank month by month, and the records
 * check for the retention period.
 */
@NgModule({
  declarations: [FinanceComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class FinanceModule {}
