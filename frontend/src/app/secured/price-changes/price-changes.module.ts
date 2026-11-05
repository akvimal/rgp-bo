import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../../@core/auth/auth.guard";
import { SharedModule } from "../../shared/shared.module";
import { PriceChangesComponent } from "./price-changes.component";

const routes: Routes = [{ path: "", component: PriceChangesComponent, canActivate: [AuthGuard] }];

/** The price changes staff sheet: what changed in the sale prices, to read at the counter or print. */
@NgModule({
  declarations: [PriceChangesComponent],
  imports: [CommonModule, FormsModule, SharedModule, RouterModule.forChild(routes)],
})
export class PriceChangesModule {}
