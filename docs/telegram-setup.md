# Telegram setup (alerts to staff, daily digest to a store group)

For the Business Head (or whoever sets up the app). Nothing needs to be set on the server: the bot is added inside the app.
The same steps are in the app guide under "Set up the shop's Telegram bot".

## What you get

| Feature | Who gets it | Where it is switched on |
|---|---|---|
| **Alerts** (bank deposit due, low stock, licence ending, ...) | Each person who connects their own Telegram | Settings > Alerts, the Alerts on Telegram box |
| **Daily digest** (sales and purchase totals, no cash or margin figures) | A store's Telegram group or a person | Settings > Notifications, per store |

Both use the one bot of the shop. Customers are not on Telegram.

## 1. Create the bot (about 2 minutes)

1. Open Telegram and search for **@BotFather** (the one with the blue tick). Press **Start**.
2. Send `/newbot`.
3. BotFather asks for a **name**, which people see in chats (for example `RGP Alerts`).
4. It then asks for a **username**. It must end in `bot` and be unused, for example `rgp_shop_alerts_bot`.
5. BotFather replies with a **token** like `123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw`. Copy all of it.

Keep the token private. Anyone who has it can send messages as your bot. If it leaks, send `/revoke` to BotFather, pick the bot, and paste the new token into the app.

Optional but nice: `/setuserpic` for a logo, `/setdescription` for a line such as "Alerts from the shop".
Leave `/setprivacy` as it is: the bot only needs to read commands such as `/chatid`, which work in a group with the default.

## 2. Add the bot in the app

1. Sign in as the Business Head and open **Settings > Alerts**.
2. In the **Alerts on Telegram** box press **Add the bot**.
3. Paste the **token**.
4. **App address** (optional): the address people type to open the app, starting with `https://`, for example `https://ops.myrgp.in`. Messages use it to add a link to the right page. `http://` addresses are refused because Telegram messages should not carry insecure links. Leave it empty for no links.
5. Press **Check and save**.

What happens: the app asks Telegram who the token belongs to. If Telegram accepts it, the bot's name appears in the box (`Bot: @rgp_shop_alerts_bot`) and the token is stored **encrypted**; only its last four characters are ever shown again. If it does not, you see the reason and nothing is saved.

| Message | Meaning and fix |
|---|---|
| Paste the whole token from BotFather, like 123456789:AAH... | The text is not shaped like a token. Copy again, with no spaces or line breaks. |
| The bot token is not accepted by Telegram | The token is wrong or was revoked. Copy it again from BotFather (`/mybots`, pick the bot, API Token). |
| Telegram could not be reached | The server cannot reach api.telegram.org. Ask whoever hosts the app to allow outgoing HTTPS to it. |
| The app address must start with https:// | Use an `https://` address or leave it empty. |
| Only the owner can set up the Telegram bot | Sign in as the Business Head. |

6. Tick **Send alerts to staff on Telegram** in the same box.

To change the bot later, press **Add the bot** again and paste the new token. **Remove from the app** deletes the saved bot (alerts then stop, unless the server has its own bot set; see the last section).

## 3. Staff connect themselves

A bot can only write to a person who pressed Start, so each person links their own Telegram once:

1. Open the bell, then **Notifications**.
2. In **Alerts on Telegram** press **Connect Telegram**, then **Open Telegram**.
3. In the chat press **Start**. The app page changes to **Connected** within a few seconds.
4. Choose the **level** (everything, warnings and up, or critical only) and **quiet hours**, then **Save**. Press **Send a test** to check.

The link they use works once and for 15 minutes. If it expires, press Connect Telegram again.

What they receive:

- Only alerts they are allowed to see in the app, for their stores.
- At or above their chosen level. Critical alerts come at any hour; others wait until quiet hours end (22:00 to 07:00 India time by default).
- At most 12 an hour below critical, so a burst does not flood a phone.
- A failed send is retried after 1, 5, 30, 120 and 360 minutes.

In the bot chat: `/status` shows their settings, `/stop` stops alerts, and `/start` with no link explains how to connect.

You see who is connected, who is blocked or stopped, and how many messages were sent, waiting or failed in the last 7 days, in the same Settings > Alerts box.

## 4. Daily digest to a store group (optional)

1. Create a Telegram group for the store and add the staff who should see the digest.
2. Add your bot to the group as a member.
3. In the group send `/chatid`. The bot replies with the group's **chat ID** (a number, usually starting with `-`).
4. Open **Settings > Notifications**, paste the chat ID against the store, keep the switch on, and press **Send test**.

A store with no chat ID, or switched off, gets no digest. The digest never includes cash or margin figures.

## 5. Shift open and close messages (automatic)

Every time a shift opens or closes (a handover counts as both), the shop is told. Nothing more to set up once the bot is added and people have connected.

| | Owners and the store's heads (personal message) | The store's group (if its chat ID is set) |
|---|---|---|
| **Opened** | store, shift, hours, time opened, who opened it, whose drawer, opening float (and if it came from the vault), the shift it took over from | store, shift, hours, time opened |
| **Closed** | bills, items, sales; **bills and sales by staff**; **cash against UPI/card** with percentages and UPI/card by app; **deliveries** (total, delivered, waiting, failed); **expenses** with the biggest items; drawer expected, counted and difference; terminal totals; refunds and money banked; reconciled or not | bills, items, sales; cash, UPI/card and credit totals; customers; whether it matches. No staff names, no drawer figures |

Settings > Alerts > **Shift messages** has three switches: message when a shift opens, message when a shift closes, and **send the full version to the store group too** (off by default, because everyone in the group can read it). The whole feature also stops if **Send alerts to staff on Telegram** is off. Each shift sends each message once, even if the close is pressed again.

## 6. Moving to a different bot or phone

- A new bot: add it again in the app (section 2). People must press Connect Telegram again, because chats belong to a bot.
- A person's new phone: they install Telegram, sign in, and press Disconnect then Connect Telegram on the Notifications page.
- Someone who leaves: switch them off in Settings > Users. They stop receiving alerts as soon as they cannot sign in.

## Testing without touching the shop

Create a second bot in BotFather and use it for any test or demo copy. Two copies of the app polling with the same token take each other's messages, and test alerts would reach real staff.

## For the person who hosts the app

The app can still read the bot from the server's environment, for installs that were set up before the in-app page existed:

| Variable | Use |
|---|---|
| `TELEGRAM_BOT_TOKEN` | the token |
| `TELEGRAM_BOT_USERNAME` | the bot's @name (optional; the app asks Telegram if it is missing) |
| `APP_BASE_URL` | the app's public address, for links in messages |
| `TELEGRAM_POLL=off` | stops the app listening for people pressing Start (alerts still send) |
| `TELEGRAM_API_BASE` | testing only: a stand-in for Telegram |

A bot saved in the app **wins** over these. The app needs outgoing HTTPS to `api.telegram.org`; it uses polling, so no public address or open port is needed for Telegram.
