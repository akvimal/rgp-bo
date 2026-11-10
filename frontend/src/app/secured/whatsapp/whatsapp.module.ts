import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { WhatsappComponent } from "./whatsapp.component";

const routes: Routes = [{ path: "", component: WhatsappComponent, canActivate: [AuthGuard] }];

/** The store's WhatsApp number for messages to customers (bill copies first), and what has been sent. */
@NgModule({
  declarations: [WhatsappComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class WhatsappModule {}
