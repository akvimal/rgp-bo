import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { VendorIssuesComponent } from "./vendor-issues.component";

const routes: Routes = [{ path: "", component: VendorIssuesComponent, canActivate: [AuthGuard] }];

/** Invoice corrections and defective goods raised with vendors, tracked to a settlement. */
@NgModule({
  declarations: [VendorIssuesComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class VendorIssuesModule {}
