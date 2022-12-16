import { Component } from "@angular/core";

@Component({
    templateUrl: './pos.component.html'
})
export class PosComponent {

    login:{userid?:string,pin?:string}={};
    loginInput = false;    

    users = [{
            id: 100,
            pin: 1111, 
            authenticated:false,
            locked:false
        },
        {
            id: 200,
            pin: 2222, 
            authenticated:false, 
            locked:false
        }]

    showLogin(){
        this.loginInput = true;
    }

    loginUser(){
        const user = this.users.find((u:any) => (u.id == this.login.userid && u.pin == this.login.pin))
        if(user) {
            this.users = [...this.users].map(u => {
                return {...u, authenticated: u.authenticated || u.id === user.id}
            });
        }
        this.loginInput = false;
    }

    logout(id:any){
        this.users = [...this.users].map(u => {
            return {...u, authenticated: u.id === id ? false : u.authenticated}
        });
    }
}