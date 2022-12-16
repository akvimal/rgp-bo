import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "src/app/@core/auth/auth.guard";
import { SharedModule } from "src/app/shared/shared.module";
import { UserEditFormComponent } from "./components/user-edit-form.component";
import { UserFormComponent } from "./components/user-form.component";
import { UserListComponent } from "./components/user-list.component";
import { UsersComponent } from "./components/users.component";

const routes: Routes = [
  { path: '', redirectTo: 'list'},
    {path: 'list', component: UserListComponent, canActivate:[AuthGuard]},
    {path: 'new', component: UserFormComponent, canActivate:[AuthGuard]},
    {path: 'edit/:id', component: UserEditFormComponent, canActivate:[AuthGuard]}
];
@NgModule({
    declarations: [
      UsersComponent,
      UserListComponent,
      UserFormComponent,
      UserEditFormComponent
    ],
    imports: [
        CommonModule,
        ReactiveFormsModule,
        RouterModule.forChild(routes),
        SharedModule
    ],
    exports: [RouterModule]
  })
export class UsersModule{}