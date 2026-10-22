import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { KpiRateComponent } from "./kpi-rate.component";
import { KpiMineComponent } from "./kpi-mine.component";

const routes: Routes = [
  { path: "", redirectTo: "mine", pathMatch: "full" },
  { path: "rate", component: KpiRateComponent, canActivate: [AuthGuard] },
  { path: "mine", component: KpiMineComponent, canActivate: [AuthGuard] },
];

/** Managers rate the manual KPI measures; every staff member sees their own finalised scores. */
@NgModule({
  declarations: [KpiRateComponent, KpiMineComponent],
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes)],
})
export class KpiModule {}
