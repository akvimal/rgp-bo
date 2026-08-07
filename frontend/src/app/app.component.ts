import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { TokenRefreshService } from './@core/auth/token-refresh.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  providers: [MessageService]
})
export class AppComponent implements OnInit {

  constructor(private tokenRefreshService: TokenRefreshService) {}

  ngOnInit() {
    this.tokenRefreshService.scheduleFromStoredToken();
  }
}
