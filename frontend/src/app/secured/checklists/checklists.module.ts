import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { ChecklistsComponent } from "./checklists.component";

const routes: Routes = [{ path: "", component: ChecklistsComponent, canActivate: [AuthGuard] }];

/**
 * Checklists. Fill in a store's lists (outage readiness, opening, closing, housekeeping), change the lists, and switch on, off or move the
 * weekly and monthly tasks the system puts in the store's to-do list. The printed price list and outage procedure are reached from the
 * Outage readiness list. Open to everyone who bills; changing lists and tasks is for the people who run the store.
 */
@NgModule({
  declarations: [ChecklistsComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class ChecklistsModule {}
