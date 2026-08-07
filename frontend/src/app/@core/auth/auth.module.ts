import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { RouterModule, Routes } from "@angular/router";
import { ChangePwdComponent } from "./changepwd/changepwd.component";
import { LoginComponent } from "./login/login.component";
import { LogoutComponent } from "./logout/logout.component";

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'logout', component: LogoutComponent },
  { path: 'changepassword', component: ChangePwdComponent }
];

@NgModule({
    declarations: [
      LoginComponent,
      ChangePwdComponent
    ],
    imports: [
        CommonModule,
        ReactiveFormsModule,
        RouterModule.forChild(routes)
    ],
    exports: [RouterModule]
  })
export class AuthModule{}