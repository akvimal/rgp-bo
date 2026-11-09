import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { DialogModule } from "primeng/dialog";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { DocumentsModule } from "../documents/documents.module";
import { FeedbackComponent } from "./feedback.component";

const routes: Routes = [{ path: "", component: FeedbackComponent, canActivate: [AuthGuard] }];

/** Help and feedback: your own reports and the answers, and for those who answer, the inbox. The report form itself is opened from the floating button. */
@NgModule({
  declarations: [FeedbackComponent],
  imports: [CommonModule, FormsModule, DialogModule, SharedModule, DocumentsModule, RouterModule.forChild(routes)],
})
export class FeedbackModule {}
