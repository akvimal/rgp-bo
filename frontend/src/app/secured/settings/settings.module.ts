import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

import { AutoCompleteModule } from 'primeng/autocomplete';
import { CalendarModule } from 'primeng/calendar';
import { RouterModule, Routes } from "@angular/router";
import { AuthGuard } from "src/app/@core/auth/auth.guard";
import { SharedModule } from "src/app/shared/shared.module";
import { DialogModule } from 'primeng/dialog';
import { TabViewModule } from 'primeng/tabview';
import { InputNumberModule } from 'primeng/inputnumber';
import { TableModule } from "primeng/table";
import { SettingsComponent } from "./components/settings.component";
import { UsersComponent } from "./users/components/users.component";
import { RolesComponent } from "./roles/components/roles.component";
import { RoleListComponent } from "./roles/components/role-list.component";
import { RoleFormComponent } from "./roles/components/role-form.component";
import { UserListComponent } from "./users/components/user-list.component";
import { UserFormComponent } from "./users/components/user-form.component";
import { UserEditFormComponent } from "./users/components/user-edit-form.component";
import { ChangePasswordComponent } from "./users/components/change-password.component";
import { SecurityDashboardComponent } from "./components/security-dashboard.component";
import { SecurityDashboardService } from "./security-dashboard.service";

const routes: Routes = [
  { path: '', component: SettingsComponent, canActivate:[AuthGuard], children: [
    { path: 'users', component: UsersComponent, children: [
      { path: '', redirectTo: 'list'},
      { path: 'list', component: UserListComponent },
      { path: 'new', component: UserFormComponent },
      { path: 'edit/:id', component: UserEditFormComponent }
    ]},
    { path: 'roles', component: RolesComponent, children: [
      { path: '',  redirectTo: 'list'},
      { path: 'list', component: RoleListComponent },
      { path: 'new', component: RoleFormComponent },
      { path: 'edit/:id', component: RoleFormComponent }
    ]},
    { path: 'change-password', component: ChangePasswordComponent },
    { path: 'security-dashboard', component: SecurityDashboardComponent }
  ]},
];

@NgModule({
    declarations: [
      SettingsComponent,
      UsersComponent,
      RolesComponent,
      RoleListComponent,
      RoleFormComponent,
      UserListComponent,
      UserFormComponent,
      UserEditFormComponent,
      ChangePasswordComponent,
      SecurityDashboardComponent
    ],
    providers: [
      SecurityDashboardService
    ],
    imports: [
        RouterModule.forChild(routes),
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        AutoCompleteModule,
        CalendarModule,
        DialogModule,
        TabViewModule,
        InputNumberModule,
        TableModule,
        SharedModule
    ],
    exports: [RouterModule]
  })
export class SettingsModule{}