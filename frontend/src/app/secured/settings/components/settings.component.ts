import { Component } from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import { filter } from "rxjs/operators";
import { SettingService } from "../settings.service";

const TITLES: { [segment: string]: string } = {
    'users': 'Users', 'roles': 'Roles', 'store': 'Store settings', 'notifications': 'Notifications',
    'business-profile': 'Business details', 'businesses': 'Businesses', 'delivery-partners': 'Delivery partners',
};

@Component({
    selector: 'app2-settings',
    templateUrl: 'settings.component.html'
})
export class SettingsComponent {
    title = 'Settings';

    constructor(private service:SettingService, private router: Router){}

    ngOnInit(){
        this.setTitle(this.router.url);
        this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => this.setTitle(e.urlAfterRedirects || e.url));
    }

    /** the page says where you are: "Settings · Users" */
    private setTitle(url: string) {
        const parts = (url || '').split('?')[0].split('/').filter(Boolean);
        const seg = parts[2];
        if (seg === 'business-profile' && parts[3] === 'setup') { this.title = 'Settings · Shop setup'; return; }
        this.title = TITLES[seg] ? `Settings \u00b7 ${TITLES[seg]}` : 'Settings';
    }
}
