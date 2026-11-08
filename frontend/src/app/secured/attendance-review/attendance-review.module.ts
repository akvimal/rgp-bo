import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { AttendanceReviewComponent } from "./attendance-review.component";

const routes: Routes = [{ path: "", component: AttendanceReviewComponent, canActivate: [AuthGuard] }];

/** Managers review each day's punches and photos, correct days, and choose who punches. */
@NgModule({
  declarations: [AttendanceReviewComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class AttendanceReviewModule {}
