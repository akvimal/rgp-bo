import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { MyHrComponent } from "./my-hr.component";

const routes: Routes = [{ path: "", component: MyHrComponent, canActivate: [AuthGuard] }];

/** A staff member's own HR: details, pay slips, leave, attendance, staff credit. */
@NgModule({
  declarations: [MyHrComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class MyHrModule {}
