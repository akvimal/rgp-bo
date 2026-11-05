import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { TodosComponent } from "./todos.component";

const routes: Routes = [{ path: "", component: TodosComponent, canActivate: [AuthGuard] }];

/** The to-do list: your own, your store's pool and, for a manager, the ones given to others. Reminders come through the alerts. */
@NgModule({
  declarations: [TodosComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class TodosModule {}
