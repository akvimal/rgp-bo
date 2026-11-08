import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../@core/auth/auth.guard";
import { TelegramHelpComponent } from "./telegram-help.component";

const routes: Routes = [{ path: "telegram", component: TelegramHelpComponent, canActivate: [AuthGuard] }];

/** Help pages, loaded on demand. Everyone signed in may open them (see AuthService.isUrlAuthorized). */
@NgModule({
  declarations: [TelegramHelpComponent],
  imports: [CommonModule, RouterModule.forChild(routes)],
})
export class HelpModule {}
