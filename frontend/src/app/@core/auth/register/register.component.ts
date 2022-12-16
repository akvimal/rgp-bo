import { Component } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { AuthService } from "../auth.service";

@Component({
    selector: 'app-register',
    templateUrl: './register.component.html'
})
export class RegisterComponent {

    error?:any;

    form = new FormGroup({
        name: new FormControl(''),
        email: new FormControl('',Validators.required),
        password: new FormControl('',Validators.required)
    });

    constructor(private router:Router, private service:AuthService){}

    onSubmit(){
        this.service.register({
            name:this.form.value.name,
            email:this.form.value.email,
            password:this.form.value.password
        }).subscribe({
            next: data => this.router.navigate(['/login']),
            error: err => this.error = err.error
        })
      }
}