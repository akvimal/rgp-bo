import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { UsersService } from "src/app/secured/settings/users/users.service";
import { AuthService } from "../auth.service";
import { CredentialsService } from "../credentials.service";

@Component({
    templateUrl: './changepwd.component.html'
})
export class ChangePwdComponent {

    error?:any;

    form = new FormGroup({
        email: new FormControl('',Validators.required),
        password: new FormControl('',Validators.required),
        newpassword: new FormControl('',Validators.required),
        confirmpassword: new FormControl('',Validators.required),
    });

    constructor(
        private router: Router,
        private authService: AuthService, 
        private userService: UsersService,
        private credService: CredentialsService){}

    onSubmit(){
        this.authService.changepwd({
            email:this.form.value.email,
            password:this.form.value.password,
            newpassword:this.form.value.newpassword,
        }).subscribe({next: data => {
            //TODO: show confirmation
            this.router.navigate(['/login']);
        }, error : err => {
            //TODO: show error
            this.error = err.message;
            }})
      }
}