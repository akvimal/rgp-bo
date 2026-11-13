import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { DialogModule } from "primeng/dialog";
import { AuthGuard } from "src/app/@core/auth/auth.guard";
import { SharedModule } from "src/app/shared/shared.module";
import { CommitmentsComponent } from "./commitments.component";
import { CommitmentViewComponent } from "./commitment-view.component";

const routes: Routes = [
  { path: "", component: CommitmentsComponent, canActivate: [AuthGuard] },
  { path: ":id", component: CommitmentViewComponent, canActivate: [AuthGuard] },
];

@NgModule({
  declarations: [CommitmentsComponent, CommitmentViewComponent],
  imports: [RouterModule.forChild(routes), CommonModule, FormsModule, DialogModule, SharedModule],
})
export class CommitmentsModule {}
