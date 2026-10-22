import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { ShiftDeskComponent } from "./shift-desk.component";

const routes: Routes = [{ path: "", component: ShiftDeskComponent, canActivate: [AuthGuard] }];

/** Staff open and close their shift here, not on the POS. */
@NgModule({
  declarations: [ShiftDeskComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class ShiftModule {}
