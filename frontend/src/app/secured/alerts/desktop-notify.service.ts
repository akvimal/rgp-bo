import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { BehaviorSubject } from "rxjs";
import { AuthService } from "src/app/@core/auth/auth.service";
import { isCounterRole } from "../menu";
import { UsersService } from "../settings/users/users.service";
import { AlertsService } from "./alerts.service";
import { describe, freshAlerts, isLevel, NotifyLevel, worthInterrupting } from "./desktop-notify";

export interface DesktopState {
  /** this browser can show them (Chrome on https or localhost) */
  supported: boolean;
  /** a shared counter login does not get them: whoever is on the till would see the last person's alerts */
  available: boolean;
  /** the browser's choice: default (not asked), granted or denied */
  permission: 'default' | 'granted' | 'denied';
  on: boolean;
  level: NotifyLevel;
}

/**
 * Chrome notifications for the alerts, while the app is open in a tab. The bell fetches the person's alerts each minute and hands them here;
 * the ones that arrive while the person is looking elsewhere (another tab, another window) become a desktop notification. Off until the person
 * turns it on, once in each browser: the choice is kept in that browser, per person.
 */
@Injectable({ providedIn: 'root' })
export class DesktopNotifyService {
  state$ = new BehaviorSubject<DesktopState>({ supported: false, available: false, permission: 'default', on: false, level: 'warning' });

  private userId: number | null = null;
  private loading = false;
  private seen = new Set<number>();
  private seeded = false;

  constructor(private users: UsersService, private alerts: AlertsService, private router: Router, private auth: AuthService) {}

  private get supported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window && window.isSecureContext !== false;
  }
  private get permission(): 'default' | 'granted' | 'denied' {
    return this.supported ? (Notification.permission as any) : 'denied';
  }
  private key() { return `rgp_desktop_alerts_${this.userId}`; }

  private stored(): { on: boolean; level: NotifyLevel } {
    try {
      const v = JSON.parse(localStorage.getItem(this.key()) || 'null');
      return { on: !!v?.on, level: isLevel(v?.level) ? v.level : 'warning' };
    } catch { return { on: false, level: 'warning' }; }
  }

  private publish(available = this.state$.value.available) {
    const s = this.stored();
    // switched on but the browser has since blocked it: it is effectively off
    this.state$.next({ supported: this.supported, available, permission: this.permission, on: s.on && this.permission === 'granted', level: s.level });
  }

  /** the person this browser is signed in as; read once */
  load() {
    if (this.userId !== null || this.loading) return;
    this.loading = true;
    this.users.getCurrentUser().subscribe({
      next: (u: any) => { this.userId = +u.id; this.loading = false; this.publish(this.supported && !isCounterRole(u?.rolename)); },
      error: () => { this.loading = false; },
    });
  }

  /** the bell hands over its alerts each time it fetches them */
  onItems(items: any[]) {
    this.load();
    const level = this.state$.value.level;
    // the first look only learns what is already there, so turning this on (or opening the app) does not notify old alerts
    const picked = freshAlerts(items || [], this.seen, level);
    (items || []).forEach((i) => this.seen.add(i.id));
    if (!this.seeded) { this.seeded = true; return; }
    const s = this.state$.value;
    if (!s.supported || !s.available || !s.on || !picked.length) return;
    if (!worthInterrupting(document.visibilityState === 'visible', document.hasFocus())) return;
    const n = describe(picked);
    if (n) this.show(n.title, n.body, n.link, n.ids.length === 1 ? n.ids[0] : null, n.tag);
  }

  private show(title: string, body: string, link: string | null, readId: number | null, tag: string) {
    try {
      const note = new Notification(title, { body, tag, icon: 'assets/img/favicon.png' });
      note.onclick = () => {
        window.focus();
        note.close();
        if (readId !== null) this.alerts.read(readId).subscribe(() => this.alerts.refresh(), () => {});
        // a link the person's role cannot open would end at the login page: stay where they are
        if (link && this.auth.isUrlAuthorized(link.split(/[?#]/)[0])) this.router.navigateByUrl(link);
      };
    } catch { /* some browsers only allow notifications from a service worker; nothing to do then */ }
  }

  /** the person pressed the button: ask the browser (it only asks on a click) and switch on when allowed. Returns a sentence when it did not work. */
  async enable(): Promise<string | null> {
    this.load();
    if (!this.supported) return 'This browser cannot show notifications here. Chrome needs the address to start with https.';
    let result = this.permission;
    if (result === 'default') result = (await Notification.requestPermission()) as any;
    if (result !== 'granted') { this.publish(); return result === 'denied' ? 'Chrome has blocked notifications for this site. Click the lock beside the address, allow Notifications, then try again.' : 'Notifications were not allowed.'; }
    this.save({ on: true, level: this.state$.value.level });
    return null;
  }

  disable() { this.save({ on: false, level: this.state$.value.level }); }
  setLevel(level: NotifyLevel) { this.save({ on: this.stored().on, level }); }

  /** a notification right now, so the person can see what they will get */
  test() { this.show('Notifications are on', 'This is what an alert will look like.', null, null, 'rgp-test'); }

  private save(v: { on: boolean; level: NotifyLevel }) {
    try { localStorage.setItem(this.key(), JSON.stringify(v)); } catch { /* a private window: it lasts until the page closes */ }
    this.publish();
  }
}
