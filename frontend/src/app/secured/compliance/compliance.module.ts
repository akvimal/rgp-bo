import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { ComplianceComponent } from "./compliance.component";

const routes: Routes = [{ path: "", component: ComplianceComponent, canActivate: [AuthGuard] }];

/** The compliance register: what is owed in the stores, by step of the ladder, with waivers. */
@NgModule({
  declarations: [ComplianceComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class ComplianceModule {}
