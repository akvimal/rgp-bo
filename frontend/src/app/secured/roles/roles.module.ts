import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "src/app/@core/auth/auth.guard";
import { SharedModule } from "src/app/shared/shared.module";
import { RoleFormComponent } from "./components/role-form.component";
import { RoleListComponent } from "./components/role-list.component";
import { RolesComponent } from "./components/roles.component";

const routes: Routes = [
    { path: '',  redirectTo: 'list'},
    { path: 'list', component: RoleListComponent, canActivate:[AuthGuard] },
    { path: 'new', component: RoleFormComponent, canActivate:[AuthGuard] },
    { path: 'edit/:id', component: RoleFormComponent, canActivate:[AuthGuard] }
];

@NgModule({
    declarations: [
      RolesComponent,
      RoleListComponent,
      RoleFormComponent
    ],
    imports: [
        CommonModule,
        ReactiveFormsModule,
        RouterModule.forChild(routes),
        SharedModule
    ],
    exports: [RouterModule]
  })
export class RolesModule{}