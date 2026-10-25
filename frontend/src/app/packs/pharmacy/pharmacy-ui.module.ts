import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ScheduleDetailComponent } from "./schedule-detail.component";

/**
 * The pieces of the pharmacy pack that sit inside core screens (today: the panel on the bill). Core screens show them only when the business has the
 * module switched on. To take the pack out, remove this import from the screens' module and the one element where each is used.
 */
@NgModule({
  declarations: [ScheduleDetailComponent],
  imports: [CommonModule, FormsModule],
  exports: [ScheduleDetailComponent],
})
export class PharmacyUiModule {}
