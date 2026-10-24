import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { ReviewComponent } from "./review.component";

const routes: Routes = [{ path: "", component: ReviewComponent, canActivate: [AuthGuard] }];

/**
 * The weekly exceptions review: discounts, cancelled bills and returns for one week, beside the week before, and the sign-off that the
 * people who run the store looked at them.
 */
@NgModule({
  declarations: [ReviewComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class ReviewModule {}
