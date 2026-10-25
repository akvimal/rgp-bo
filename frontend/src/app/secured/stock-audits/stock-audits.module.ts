import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { StockAuditsComponent } from "./stock-audits.component";
import { AuditGuideComponent } from "./audit-guide.component";

const routes: Routes = [
  { path: "", component: StockAuditsComponent, canActivate: [AuthGuard] },
  { path: "guide", component: AuditGuideComponent, canActivate: [AuthGuard] },
];

/** Routine stock audits: planned counts, who does them, and what they found. */
@NgModule({
  declarations: [StockAuditsComponent, AuditGuideComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class StockAuditsModule {}
