import { Component } from "@angular/core";
import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from "@angular/forms";

import { SettingService } from "../settings.service";
import { Setting } from "./setting.model";

@Component({
    selector: 'app2-settings',
    templateUrl: 'settings.component.html'
})
export class SettingsComponent {



    constructor(private service:SettingService){}

    ngOnInit(){
        
    }

}