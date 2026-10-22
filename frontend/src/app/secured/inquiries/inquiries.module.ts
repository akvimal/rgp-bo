import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { InquiriesComponent } from "./inquiries.component";

const routes: Routes = [{ path: "", component: InquiriesComponent, canActivate: [AuthGuard] }];

/** Customer inquiries: record, assign, follow up and close; closed and late ones feed the KPI. */
@NgModule({
  declarations: [InquiriesComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class InquiriesModule {}
