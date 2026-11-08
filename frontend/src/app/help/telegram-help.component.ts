import { Component } from "@angular/core";
import { AuthService } from "src/app/@core/auth/auth.service";

/**
 * Help: setting up Telegram. Part 1 is for the Business Head (create the bot and add it in the app), part 2 for every person who wants alerts on their phone,
 * part 3 for the daily digest to a store group, then what to do when something does not work. Static text; the same content is in docs/telegram-setup.md.
 */
@Component({
  templateUrl: "./telegram-help.component.html",
  styles: [`
    .step-no { width: 1.9rem; height: 1.9rem; flex: 0 0 1.9rem; border-radius: 50%; background: var(--rgp-brand, #4154f1); color: #fff; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: .85rem; }
    .step { display: flex; gap: .75rem; padding: .6rem 0; border-top: 1px solid var(--rgp-line, #e3e8f2); }
    .step:first-of-type { border-top: 0; }
    .step-body { flex: 1; min-width: 0; }
    .toc a { display: block; padding: .15rem 0; }
    .sample { font-family: var(--bs-font-monospace); background: var(--rgp-head-bg, #f6f8fd); border: 1px solid var(--rgp-line, #e3e8f2); border-radius: 4px; padding: .1rem .4rem; word-break: break-all; }
    @media print { .no-print { display: none !important; } .card { border: 0 !important; box-shadow: none !important; } }
  `],
})
export class TelegramHelpComponent {
  constructor(private auth: AuthService) {}

  /** the owner's settings pages are offered only to a login that can open them */
  get canAlerts(): boolean { return this.auth.isUrlAuthorized("/secure/settings/alerts"); }
  get canDigest(): boolean { return this.auth.isUrlAuthorized("/secure/settings/notifications"); }

  print() { window.print(); }

  scroll(id: string) { const e = document.getElementById(id); if (e) e.scrollIntoView({ behavior: "smooth", block: "start" }); }

  readonly problems = [
    { said: "Paste the whole token from BotFather", fix: "The text is not shaped like a token. Copy it again from BotFather with no spaces or line breaks. It looks like 123456789:AAH... and has a colon in the middle." },
    { said: "The bot token is not accepted by Telegram", fix: "The token is wrong or was revoked. In BotFather send /mybots, pick the bot, press API Token, and copy it again." },
    { said: "Telegram could not be reached", fix: "The server cannot reach api.telegram.org. Ask whoever hosts the app to allow outgoing HTTPS to that address." },
    { said: "The app address must start with https://", fix: "Use an address such as https://ops.myrgp.in, or leave the box empty for messages without links." },
    { said: "Only the owner can set up the Telegram bot", fix: "Sign in as the Business Head. Other roles cannot add or change the bot." },
    { said: "The Connect Telegram box is not on my Notifications page", fix: "The bot has not been added yet, or the Business Head has switched Telegram alerts off in Settings > Alerts." },
    { said: "I pressed Start but the page still says not connected", fix: "The link works once and only for 15 minutes. Press Connect Telegram again for a new link and press Start in that chat." },
    { said: "This Telegram account is already connected to someone else", fix: "One Telegram account can serve one person. The other person presses Disconnect on their Notifications page first." },
    { said: "My status says Blocked", fix: "Telegram refused a message because the bot was blocked or removed from the chat. Unblock the bot in Telegram, then press Reconnect on the Notifications page." },
    { said: "Alerts stopped arriving", fix: "Check, in this order: the switch Send alerts to staff on Telegram in Settings > Alerts; your own level and quiet hours on Notifications (warnings wait for the morning, critical ones do not); the 12-an-hour limit below critical; and that you did not send /stop." },
  ];
}
