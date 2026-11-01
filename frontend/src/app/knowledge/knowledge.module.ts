import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "../@core/auth/auth.guard";
import { KnowledgeComponent } from "./knowledge.component";

const routes: Routes = [{ path: "", component: KnowledgeComponent, canActivate: [AuthGuard] }];

/** The weekly knowledge check page, loaded on demand. Everyone signed in may take it. */
@NgModule({
  declarations: [KnowledgeComponent],
  imports: [CommonModule, RouterModule.forChild(routes)],
})
export class KnowledgeModule {}
