import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { GstComponent } from "./gst.component";
import { GstHsnComponent } from "./gst-hsn.component";
import { GstRatesComponent } from "./gst-rates.component";
import { GstRegisterComponent } from "./gst-register.component";
import { GstRegistrationComponent } from "./gst-registration.component";
import { GstSummaryComponent } from "./gst-summary.component";

const routes: Routes = [{ path: "", component: GstComponent, canActivate: [AuthGuard] }];

/** GST for the Business Head (GST_SIMPLE_PLAN): rate changes by date, HSN codes, the registration, the sales register and the monthly summary. */
@NgModule({
  declarations: [GstComponent, GstRegistrationComponent, GstRegisterComponent, GstSummaryComponent, GstRatesComponent, GstHsnComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class GstModule {}
