import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { OutageComponent } from "./outage.component";

const routes: Routes = [{ path: "", component: OutageComponent, canActivate: [AuthGuard] }];

/**
 * The outage kit: what the shop keeps ready to sell by hand when the power or the connection goes (weekly check, printed price list and
 * procedure) and a log of each outage. Open to everyone who bills.
 */
@NgModule({
  declarations: [OutageComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class OutageModule {}
