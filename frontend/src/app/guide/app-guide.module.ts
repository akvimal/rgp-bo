import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../@core/auth/auth.guard";
import { AppGuideComponent } from "./app-guide.component";

const routes: Routes = [{ path: "", component: AppGuideComponent, canActivate: [AuthGuard] }];

/** The app guide page, loaded on demand. Everyone signed in may open it; what it shows follows their login. */
@NgModule({
  declarations: [AppGuideComponent],
  imports: [CommonModule, FormsModule, RouterModule.forChild(routes)],
})
export class AppGuideModule {}
