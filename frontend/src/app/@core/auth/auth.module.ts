import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { ChangePwdComponent } from "./changepwd/changepwd.component";
import { LoginComponent } from "./login/login.component";
import { LogoutComponent } from "./logout/logout.component";
import { AuthShellComponent } from "./shared/auth-shell.component";
import { AuthPasswordComponent } from "./shared/auth-password.component";

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'platform/login', component: LoginComponent, data: { platform: true } },
  { path: 'logout', component: LogoutComponent },
  { path: 'changepassword', component: ChangePwdComponent }
];

@NgModule({
    declarations: [
      LoginComponent,
      ChangePwdComponent,
      AuthShellComponent,
      AuthPasswordComponent
    ],
    imports: [
        CommonModule,
        FormsModule,            // the code and set-up forms use (ngSubmit) without a formGroup, which needs NgForm
        ReactiveFormsModule,
        RouterModule.forChild(routes)
    ],
    exports: [RouterModule]
  })
export class AuthModule{}