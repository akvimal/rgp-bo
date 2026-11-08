import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { AttendancePunchComponent } from "./attendance-punch.component";

const routes: Routes = [{ path: "", component: AttendancePunchComponent, canActivate: [AuthGuard] }];

/** Mark attendance (PIN and webcam photo) on a registered store PC. */
@NgModule({
  declarations: [AttendancePunchComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class AttendancePunchModule {}
