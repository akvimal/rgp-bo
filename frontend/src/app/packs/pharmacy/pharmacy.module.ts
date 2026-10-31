import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { DrugRegisterComponent } from "./drug-register.component";
import { PharmacyUiModule } from "./pharmacy-ui.module";

const routes: Routes = [{ path: "", component: DrugRegisterComponent, canActivate: [AuthGuard] }];

/** The pharmacy pack's own screens (today: the drug register page), loaded on demand. */
@NgModule({
  declarations: [DrugRegisterComponent],
  imports: [CommonModule, FormsModule, PharmacyUiModule, RouterModule.forChild(routes)],
})
export class PharmacyModule {}
