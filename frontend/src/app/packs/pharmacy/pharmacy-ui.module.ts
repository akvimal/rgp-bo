import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { ScheduleDetailComponent } from "./schedule-detail.component";
import { RxFollowupsComponent } from "./rx-followups.component";

/**
 * The pieces of the pharmacy pack that sit inside core screens (the panel on the bill, and the prescriptions to collect in the customer worklist). Core screens show them only when the business has the
 * module switched on. To take the pack out, remove this import from the screens' module and the one element where each is used.
 */
@NgModule({
  declarations: [ScheduleDetailComponent, RxFollowupsComponent],
  imports: [CommonModule, FormsModule, RouterModule],
  exports: [ScheduleDetailComponent, RxFollowupsComponent],
})
export class PharmacyUiModule {}
