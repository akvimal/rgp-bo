import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { ChecklistsComponent } from "./checklists.component";

const routes: Routes = [{ path: "", component: ChecklistsComponent, canActivate: [AuthGuard] }];

/**
 * Checklists. Fill in a store's lists (outage readiness, opening, closing, housekeeping). Open to everyone who bills. Setting the lists up, and the
 * system's recurring tasks, is admin work in Settings > Checklists.
 */
@NgModule({
  declarations: [ChecklistsComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class ChecklistsModule {}
