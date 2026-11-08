import { Injectable } from "@angular/core";

export type ThemeChoice = "light" | "dark" | "auto";

/**
 * Light or dark for the signed-in app. The choice is remembered in this browser for each person (so a shared counter PC can stay light while
 * the owner uses dark); "auto" follows the device. It is applied only while the signed-in app is open: the login page, the counter screen and
 * printed documents stay light. Dark is html[data-theme="dark"] (src/dark.css) plus PrimeNG's dark theme, loaded on demand as prime-dark.css.
 */
@Injectable({ providedIn: "root" })
export class ThemeService {
  private static readonly LAST = "rgp_theme:last";
  private userKey = "";
  choice: ThemeChoice = "light";
  private media: MediaQueryList | null = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  constructor() {
    // follow the device while on "auto"
    if (this.media && this.media.addEventListener) this.media.addEventListener("change", () => { if (this.on) this.apply(); });
  }

  private get on(): boolean { return document.documentElement.hasAttribute("data-theme-on"); }

  private read(key: string): ThemeChoice | null {
    try { const v = localStorage.getItem(key); return v === "light" || v === "dark" || v === "auto" ? v : null; } catch { return null; }
  }

  /** the signed-in app opened: use the last choice at once (no flash), then this person's own once they are known */
  open(userId?: number | string | null) {
    if (userId !== undefined && userId !== null) this.userKey = `rgp_theme:${userId}`;
    this.choice = (this.userKey && this.read(this.userKey)) || this.read(ThemeService.LAST) || "light";
    document.documentElement.setAttribute("data-theme-on", "1");
    this.apply();
  }

  /** the signed-in app closed (sign-out, or the counter screen): back to light */
  release() {
    document.documentElement.removeAttribute("data-theme-on");
    document.documentElement.removeAttribute("data-theme");
    this.prime(false);
  }

  set(choice: ThemeChoice) {
    this.choice = choice;
    try { if (this.userKey) localStorage.setItem(this.userKey, choice); localStorage.setItem(ThemeService.LAST, choice); } catch { /* a private window: it just will not be remembered */ }
    this.apply();
  }

  /** the quick switch in the header: light and dark take turns (auto counts as whatever it is showing) */
  toggle() { this.set(this.dark ? "light" : "dark"); }

  get dark(): boolean { return this.choice === "dark" || (this.choice === "auto" && !!this.media && this.media.matches); }

  private apply() {
    const dark = this.dark;
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    this.prime(dark);
  }

  /** PrimeNG's dark theme is a separate stylesheet, present only while dark is on */
  private prime(on: boolean) {
    const id = "prime-dark-theme";
    const have = document.getElementById(id);
    if (on && !have) {
      const link = document.createElement("link");
      link.id = id; link.rel = "stylesheet"; link.href = "prime-dark.css";
      document.head.appendChild(link);
    } else if (!on && have) {
      have.remove();
    }
  }
}
