import { Component, OnInit } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { LoadingService } from './shared/loading.service';
import { MessageService } from 'primeng/api';
import { TokenRefreshService } from './@core/auth/token-refresh.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  providers: [MessageService]
})
export class AppComponent implements OnInit {

  constructor(private tokenRefreshService: TokenRefreshService, private router: Router, public loading: LoadingService) {}

  ngOnInit() {
    this.tokenRefreshService.scheduleFromStoredToken();
    // a page being opened (a screen that is loaded on first use can take a moment) shows the bar too
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart) this.loading.navigation(true);
      else if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) this.loading.navigation(false);
    });
  }
}
