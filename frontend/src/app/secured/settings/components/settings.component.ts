import { Component } from "@angular/core";
import { SettingService } from "../settings.service";

@Component({
    selector: 'app2-settings',
    templateUrl: 'settings.component.html'
})
export class SettingsComponent {
    constructor(private service:SettingService){}
    ngOnInit(){}

}