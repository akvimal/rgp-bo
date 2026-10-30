import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../../@core/auth/auth.guard";
import { PharmacyGuideComponent } from "./pharmacy-guide.component";

const routes: Routes = [{ path: "", component: PharmacyGuideComponent, canActivate: [AuthGuard] }];

/** The pharmacy guide page (pharmacy pack), loaded on demand. */
@NgModule({
  declarations: [PharmacyGuideComponent],
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes)],
})
export class PharmacyGuideModule {}
