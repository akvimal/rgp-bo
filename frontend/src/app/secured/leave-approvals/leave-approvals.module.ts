import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { LeaveApprovalsComponent } from "./leave-approvals.component";

const routes: Routes = [{ path: "", component: LeaveApprovalsComponent, canActivate: [AuthGuard] }];

/** Leave requests waiting for the Business Head or the Store Head of the person's store. */
@NgModule({
  declarations: [LeaveApprovalsComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class LeaveApprovalsModule {}
