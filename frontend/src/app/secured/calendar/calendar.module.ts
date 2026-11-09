import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { CalendarComponent } from "./calendar.component";

const routes: Routes = [{ path: "", component: CalendarComponent, canActivate: [AuthGuard] }];

/** The calendar: a read-only month, week and day view of what is dated across the app. */
@NgModule({
  declarations: [CalendarComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class CalendarModule {}
