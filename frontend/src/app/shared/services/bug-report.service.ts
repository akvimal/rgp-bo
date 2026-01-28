import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SystemInfo {
  browser: string;
  os: string;
  currentRoute: string;
  userAgent: string;
  screenResolution: string;
  timestamp: string;
}

export interface BugReportDto {
  title: string;
  description: string;
  stepsToReproduce?: string;
  systemInfo: SystemInfo;
}

export interface BugReportResponse {
  issueUrl: string;
}

@Injectable({
  providedIn: 'root'
})
export class BugReportService {
  private apiUrl = `${environment.apiHost}/bug-reports`;

  constructor(private http: HttpClient) {}

  /**
   * Submit a bug report
   */
  submitBugReport(bugReport: BugReportDto): Observable<BugReportResponse> {
    return this.http.post<BugReportResponse>(this.apiUrl, bugReport);
  }

  /**
   * Capture system information automatically
   */
  captureSystemInfo(): SystemInfo {
    return {
      browser: this.getBrowserInfo(),
      os: this.getOSInfo(),
      currentRoute: window.location.href,
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get browser name and version from user agent
   */
  private getBrowserInfo(): string {
    const ua = navigator.userAgent;
    let browserName = 'Unknown';
    let browserVersion = '';

    // Chrome
    if (ua.indexOf('Chrome') > -1 && ua.indexOf('Edg') === -1) {
      browserName = 'Chrome';
      const match = ua.match(/Chrome\/(\d+\.\d+)/);
      browserVersion = match ? match[1] : '';
    }
    // Edge (Chromium)
    else if (ua.indexOf('Edg') > -1) {
      browserName = 'Edge';
      const match = ua.match(/Edg\/(\d+\.\d+)/);
      browserVersion = match ? match[1] : '';
    }
    // Firefox
    else if (ua.indexOf('Firefox') > -1) {
      browserName = 'Firefox';
      const match = ua.match(/Firefox\/(\d+\.\d+)/);
      browserVersion = match ? match[1] : '';
    }
    // Safari
    else if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) {
      browserName = 'Safari';
      const match = ua.match(/Version\/(\d+\.\d+)/);
      browserVersion = match ? match[1] : '';
    }
    // IE
    else if (ua.indexOf('MSIE') > -1 || ua.indexOf('Trident/') > -1) {
      browserName = 'Internet Explorer';
      const match = ua.match(/(?:MSIE |rv:)(\d+\.\d+)/);
      browserVersion = match ? match[1] : '';
    }

    return browserVersion ? `${browserName} ${browserVersion}` : browserName;
  }

  /**
   * Get operating system from user agent
   */
  private getOSInfo(): string {
    const ua = navigator.userAgent;

    if (ua.indexOf('Win') > -1) {
      if (ua.indexOf('Windows NT 10.0') > -1) return 'Windows 10/11';
      if (ua.indexOf('Windows NT 6.3') > -1) return 'Windows 8.1';
      if (ua.indexOf('Windows NT 6.2') > -1) return 'Windows 8';
      if (ua.indexOf('Windows NT 6.1') > -1) return 'Windows 7';
      return 'Windows';
    }
    if (ua.indexOf('Mac') > -1) return 'macOS';
    if (ua.indexOf('Linux') > -1) return 'Linux';
    if (ua.indexOf('Android') > -1) return 'Android';
    if (ua.indexOf('iOS') > -1 || ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) return 'iOS';

    return 'Unknown OS';
  }
}
