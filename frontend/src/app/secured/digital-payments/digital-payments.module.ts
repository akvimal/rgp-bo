import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { DigitalPaymentsComponent } from "./digital-payments.component";

const routes: Routes = [{ path: "", component: DigitalPaymentsComponent, canActivate: [AuthGuard] }];

/** Manual reconciliation of QR and card machine payments against the Paytm statement. */
@NgModule({
  declarations: [DigitalPaymentsComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class DigitalPaymentsModule {}
