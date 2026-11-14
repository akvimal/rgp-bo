# Changelog

## [3.4.0](https://github.com/akvimal/rgp-bo/compare/v3.3.0...v3.4.0) (2026-11-14)


### Features

* **ai:** AI assistant settings page with model per job and level, usage log and monthly limit; QA specs and release checklist ([9985d00](https://github.com/akvimal/rgp-bo/commit/9985d00e516c6edfd1eab1b2222df5b9fe92f86e))
* **ai:** keep the assistant's answers and limit refreshes - buying brief, questions, coaching note, weekly summary ([95c11bd](https://github.com/akvimal/rgp-bo/commit/95c11bd1157f5279c2913390a7aae020ed85e398))
* **ai:** Where the assistant is used - requests, failures, time, tokens, models and a 30-day chart for every AI area ([65ec72f](https://github.com/akvimal/rgp-bo/commit/65ec72ff1b74310a67b8d213e78a6463135f86bf))
* **alerts:** set up the Telegram bot in the app (token encrypted, checked with Telegram) instead of environment variables ([daba123](https://github.com/akvimal/rgp-bo/commit/daba12381823b5c30a951f169662164313ad291e))
* **auth:** registered store PCs skip the authenticator and sign the Counter login in ([50b89a3](https://github.com/akvimal/rgp-bo/commit/50b89a32e4b4216288c1dda7b3e9b91a80c21d8f))
* **bill:** new bill layout, per-store footer template, WhatsApp copy and walk-in customer ([8a512a0](https://github.com/akvimal/rgp-bo/commit/8a512a0b49999d4f326c6d8093394e6410834010))
* **bill:** separate bill print profile per business (amount in words, name sign, social handles, next refill) and a tighter header and columns ([fb5fbaf](https://github.com/akvimal/rgp-bo/commit/fb5fbaf69c2dafe406d544dd56296af99328c5ba))
* **calendar:** ask for leave from the calendar, with cover at the store and withdraw ([151125b](https://github.com/akvimal/rgp-bo/commit/151125bb044a2aa773486213a55f45fbcf118b42))
* **calendar:** read-only calendar of leave, holidays, to-dos, licences, audits and follow-ups ([ba8e4f7](https://github.com/akvimal/rgp-bo/commit/ba8e4f7fc53c84bf93f82197bf0175aeec30db5f))
* **commitments:** the New customer order form follows the standard form layout, with required marks, line totals, balance due and early checks ([7ba812a](https://github.com/akvimal/rgp-bo/commit/7ba812a76fda23d0ef1245477203a5f4ea1e7c41))
* **customers:** households - one mobile, several people, one account ([2e28e76](https://github.com/akvimal/rgp-bo/commit/2e28e762695b170273d019049827a3a7d71a9895))
* **customers:** keep a customer without a mobile number, told apart by name and location ([f10ae6e](https://github.com/akvimal/rgp-bo/commit/f10ae6eb01a4e92ace39b3f147ad7b62786a24d5))
* **delivery:** name the drawer a cash delivery cost comes from, and let a Store Head or above pay from another open shift ([c701582](https://github.com/akvimal/rgp-bo/commit/c7015828f3d46737996bd1f46dce4a3e5b6714a3))
* **delivery:** record how the delivery charge was paid; digital charges count in the shift's digital takings ([6f57dc6](https://github.com/akvimal/rgp-bo/commit/6f57dc6e1a71443d4a2ea2b44704fb53f7f66eec))
* **delivery:** short Manage Delivery dialog, cost with how it was paid, and linking costs already recorded as expenses ([bde89a3](https://github.com/akvimal/rgp-bo/commit/bde89a3bf9df90023efb6e228868e2768ff7d78e))
* **expenses:** category level and group, software categories, yearly repeats ([f96eddf](https://github.com/akvimal/rgp-bo/commit/f96eddfc8d16d92080d83ed54e2edeab57597e60))
* **expenses:** paid by defaults to cash, a cash expense says where the cash came from, a bank expense names its account and reference ([0430c20](https://github.com/akvimal/rgp-bo/commit/0430c20805d312c167f4ea29ccc9f8d9819bdc54))
* **expiry:** alert for an approved out-pass not confirmed, Disposals tab on the Drug register, Move opens the transfer with the batch chosen ([6bc973a](https://github.com/akvimal/rgp-bo/commit/6bc973aacd30f78f5121d86dc76506f709885e8f))
* **expiry:** backlog pass for expired stock still on the books, review and tag of old write-offs, expiry write-off statement ([9604b15](https://github.com/akvimal/rgp-bo/commit/9604b15ae70089f8e63a4006a26100d1ffb70a0a))
* **expiry:** expiry inside the stock audit, sign-off held until expired batches have an out-pass or an explanation ([d0a268e](https://github.com/akvimal/rgp-bo/commit/d0a268eceb1cae37c0520f8da37e52499fd7c216))
* **expiry:** out-pass for goods that leave as waste, held quantity, vendor take-back setting, scheduled-drug disposal register ([0b32d30](https://github.com/akvimal/rgp-bo/commit/0b32d30028fe6095ce7b3af5754466ba1c22b6df))
* **expiry:** Stock &gt; Expiry by band with discard, return and move; Out-passes list and detail; Held column ([ad52481](https://github.com/akvimal/rgp-bo/commit/ad524811f50a01e998c462a0512ecb150dd0124a))
* **expiry:** Write-offs screens (review of old write-offs, statement), backlog from the Expiry screen ([801b29b](https://github.com/akvimal/rgp-bo/commit/801b29bc8e48f3dd43c6e292e8e3bc10fa84674e))
* **feedback:** Help and feedback is a business module, off until the owner switches it on ([9d825f6](https://github.com/akvimal/rgp-bo/commit/9d825f6c6bd5ebebc5f54ea96f6b2f3e629682b4))
* **feedback:** report an issue, ask a question or suggest a feature, and read the answer ([433e97b](https://github.com/akvimal/rgp-bo/commit/433e97bb5b21a82b140807eb6b4d39a2eeee892c))
* **finance:** delete a bank account that nothing refers to ([e1fc4b1](https://github.com/akvimal/rgp-bo/commit/e1fc4b1859e46073b28ba72cc4c2133ba17e0e52))
* **gst:** adjustments section (expired write-offs, vendor returns and credits, goods given out) and sample/gift/own-use stock-out reasons ([267cd27](https://github.com/akvimal/rgp-bo/commit/267cd273bcc95abf27a52f9ae8fc3d7bd43d028f))
* **gst:** every rate in the Monthly summary links to the sales lines at that rate; all sales on a Sales items sheet in the Excel ([f1717c9](https://github.com/akvimal/rgp-bo/commit/f1717c9229c85ab7ef758523197cd10269d6a9ae))
* **gst:** monthly sales report in filing order (rates, returns, B2B/B2C, nil-rated/exempt/non-GST, tie-out, documents) replacing the summary's output table ([3d850b2](https://github.com/akvimal/rgp-bo/commit/3d850b22d4059130a58f559a9b3bbb199e962875))
* **help:** Telegram help page for everyone, guide walkthrough and docs/telegram-setup.md; links from Alerts and Notifications ([52805b3](https://github.com/akvimal/rgp-bo/commit/52805b373527ed1e037c16cb103cbf47f9eeedcd))
* **hr:** AI-drafted job roles, KPIs and fixed-amount incentives, with KPI to-dos and alerts ([f20aa02](https://github.com/akvimal/rgp-bo/commit/f20aa029b8bc252d8943bd3d45bff8ac08529a54))
* **hr:** attendance by PIN and webcam photo on a registered store PC, with manager review ([64a1740](https://github.com/akvimal/rgp-bo/commit/64a17405cf7c840350dd0fe509f5a51d77086384))
* **hr:** attendance Rules tab, payroll hold banner with link to the review; fix review photos, filter lag and query-string route check ([f9a50ce](https://github.com/akvimal/rgp-bo/commit/f9a50ceced3186a0ddce5fb00078020e8b8fd3d6))
* **hr:** leave policy - monthly accrual, waiting period, days together limit, advised days ([91290af](https://github.com/akvimal/rgp-bo/commit/91290afbf790d9b474099e7268660d5312ef2c8d))
* **hr:** remove a KPI measure (deleted when never scored, otherwise switched off so past months read the same) ([0cc4dc3](https://github.com/akvimal/rgp-bo/commit/0cc4dc32b30664be42f6084e21d2f0d899ad362b))
* **insights:** ask the shop, buying brief with expiry risk, weekly owner summary (Telegram), customer follow-up dues and Tamil/English wording, staff coaching notes; migration 173 ([7aae548](https://github.com/akvimal/rgp-bo/commit/7aae548ccd070d774fcbc142dd7ec9fc4bc8640e))
* **kpi:** My KPI shows how the month is measured, not only finalised months ([3da2b6a](https://github.com/akvimal/rgp-bo/commit/3da2b6aa0ab3c4a79a82c72cb6d9535638595c66))
* **pharmacy:** the prescriber is not asked for when there is no prescription in hand ([6539d04](https://github.com/akvimal/rgp-bo/commit/6539d0428584325673c4a31edd1df01fde3ac157))
* **pos:** brand dictionary - check an unfamiliar brand's generic composition at the counter ([761ee0c](https://github.com/akvimal/rgp-bo/commit/761ee0c6ffce02794f6596714e61b130a64dba26))
* **pos:** no payment mode by default; Complete stays disabled until one is chosen ([9a58698](https://github.com/akvimal/rgp-bo/commit/9a5869817e3a5ec36a9368d04c981d0d1a9558d2))
* **pos:** Save customer button for a new customer typed at the counter ([f9eda27](https://github.com/akvimal/rgp-bo/commit/f9eda27dfd4f18809d05ee39a5467dbcb143a770))
* **price-changes:** list only products bought in the last year, not expired, with stock left ([1c1ead3](https://github.com/akvimal/rgp-bo/commit/1c1ead33d6e0545a07b105b5db90af091303d995))
* **prices:** price changes staff sheet ([18e11e9](https://github.com/akvimal/rgp-bo/commit/18e11e979e44dfd7827f38f59624f650728bd818))
* **pricing:** bulk update of prices (same as MRP or % off MRP) on the price list; products that cannot be priced are skipped and listed ([be3267f](https://github.com/akvimal/rgp-bo/commit/be3267f156ac839f6916e7add9db90e182531284))
* **pricing:** quick price pick in the Set the price dialog and on the invoice's new-product rows ([1bacba2](https://github.com/akvimal/rgp-bo/commit/1bacba236d0ae618a1ca45ded88e79e30bee37ba))
* **purchase-gst:** the period is picked on a calendar, and the page has a How this works help card for the reconciliation process ([93b8a2b](https://github.com/akvimal/rgp-bo/commit/93b8a2b011f28db9422b0d49acc4be47be836881))
* **purchase:** adjust a vendor return on a completed invoice that has nothing paid on it ([5f68d39](https://github.com/akvimal/rgp-bo/commit/5f68d3913f1174343f862a122ce31e95f8ad7f08))
* **purchase:** checked scan lines are read-only and the items button says what it does ([51e865f](https://github.com/akvimal/rgp-bo/commit/51e865fb714a47f40e53f1a2fd80ce3c1cc69566))
* **purchase:** fill a new request's vendor from the product's last purchase and sort requests by date ([4a6a2ee](https://github.com/akvimal/rgp-bo/commit/4a6a2ee9086f51023cf3c81ba7e7d5b495813986))
* **purchase:** four invoice cards that do not overlap instead of eight ([dac02cc](https://github.com/akvimal/rgp-bo/commit/dac02cc3ffb9a7c49ad543cbaf91756834a24f5c))
* **purchase:** invoice built from a purchase order, PO add-items table, stock summary and quick price set ([9a72554](https://github.com/akvimal/rgp-bo/commit/9a725545707b3fadf2ea4537939a4620bb8f4184))
* **purchase:** invoice copy lines show GST and net totals; a new product's match is saved; verification is its own step ([eaf1ba8](https://github.com/akvimal/rgp-bo/commit/eaf1ba8e2644af87ca5588db79978c60c6a18d7b))
* **purchase:** purchase history dialog from a purchase invoice line ([9c300f7](https://github.com/akvimal/rgp-bo/commit/9c300f7bab0e9de09de0ddb20de33b017bb67f54))
* **purchase:** purchase request slips (several products at once) and the asking store on every request ([902e839](https://github.com/akvimal/rgp-bo/commit/902e839a6299b66c4a7d17fae5904e3660b6ac25))
* **purchase:** read scanned invoices with the assistant when the plain reader does not add up ([8d4a28f](https://github.com/akvimal/rgp-bo/commit/8d4a28fbeec5898bc15604a3d3177513fc1d6947))
* **purchases:** approval for payment of purchase invoices ([0600025](https://github.com/akvimal/rgp-bo/commit/0600025bc1053e165f7efb53300490dc0b88e29a))
* **purchases:** communication status on the invoice Pay dialog and in the payment history ([8e44bd4](https://github.com/akvimal/rgp-bo/commit/8e44bd4e35ce4a0fff141d53077a5b0fc94ab7cc))
* **purchases:** reorder screen help panel and a compact settings form ([be16a1b](https://github.com/akvimal/rgp-bo/commit/be16a1b1db9a0a255e6e7f1dfe4df53f25fd28cb))
* **purchases:** save a scanned invoice as a draft and check its lines one by one ([3660996](https://github.com/akvimal/rgp-bo/commit/366099676aedcfc27f1e3cb1f0851683e3953012))
* **purchases:** the payable follows the invoice's printed net total, and completion verifies it ([cee4f1f](https://github.com/akvimal/rgp-bo/commit/cee4f1f31fd6fac0c3232707e8c8d4e481dc401a))
* **purchases:** the payments panel under an invoice can be hidden ([8926d2b](https://github.com/akvimal/rgp-bo/commit/8926d2bd5d2c210d96bc18bf33edd211c0283529))
* **purchase:** stock history dialog on every Reorder row ([70f7f33](https://github.com/akvimal/rgp-bo/commit/70f7f33df5e64d16eefe5d0ef22dd55e44f60efd))
* **purchases:** vendor returns show and search by the invoice the goods came in on ([8243c0c](https://github.com/akvimal/rgp-bo/commit/8243c0cf531d6bef093605946d5540b2e7e0c9f9))
* **purchases:** vendor returns tracked separately and credited on a later invoice ([2633d56](https://github.com/akvimal/rgp-bo/commit/2633d562b6b7dafa4085a8ff011fba464972b40a))
* **purchase:** the edit invoice header follows the new form (order at the top with its lines, same wording) ([a0e2a7f](https://github.com/akvimal/rgp-bo/commit/a0e2a7f72b319814c3a1c66fff4954d05a7b9bca))
* **purchase:** the invoice list shows the last year by default, with a Show all years box ([495a61c](https://github.com/akvimal/rgp-bo/commit/495a61c3066a4dcce5ed7c0b238a4fb2da963598))
* **review:** weekly review compares with usual for the same days of the month, with exception rates and month to date ([fffa6d7](https://github.com/akvimal/rgp-bo/commit/fffa6d79d461d12e3c25101017eff37176eedb42))
* **review:** weekly review opens with the week at a glance (tiles, what to look at first), three tabs, collapsible lists, plainer words ([b0bbd6e](https://github.com/akvimal/rgp-bo/commit/b0bbd6ef5644fc309a136df2ab566edbc053caaf))
* **review:** weekly review shows refill capture - did the customers due for a chronic refill come back ([04653ca](https://github.com/akvimal/rgp-bo/commit/04653cae4d5ea0a0ce333acf7f4db3a88af60cd3))
* **review:** weekly review step 2 - same dates a year ago, and each person against the others ([4361437](https://github.com/akvimal/rgp-bo/commit/43614378342bb5039b2b1b1fcdff177aa281a61e))
* **review:** weekly review step 3 - margin and mix, cash drawer, pay later, unmet requests ([1498ad2](https://github.com/akvimal/rgp-bo/commit/1498ad2046cbecb047ace1f9890709209c051eea))
* **review:** weekly review step 4 - brand checks at the counter are kept and counted; margin per person ([70f8b9c](https://github.com/akvimal/rgp-bo/commit/70f8b9c035d019b53805a82c7f4ad687029e19bf))
* **sale:** customer commitments (advance-paid orders, shift-tallied, held on arrival) and a staff-only bill comment required for pay later ([b34ad72](https://github.com/akvimal/rgp-bo/commit/b34ad7258d8e4fd5b29cdb58533c9a8e5a4a78aa))
* **sales:** bill details panel, row menu, and new delivery from a bill ([37e459a](https://github.com/akvimal/rgp-bo/commit/37e459a5558f7108d970350ae4ffb2b0056801f4))
* **sales:** Business Head can force-void a bill the ordinary void refuses ([3ac8ed5](https://github.com/akvimal/rgp-bo/commit/3ac8ed573fd83255eb552c83c8245b25b302af62))
* **sales:** change a completed bill to delivery, plus shift report and vendor rounding fixes ([daa0dd3](https://github.com/akvimal/rgp-bo/commit/daa0dd39ffd848380ad939d34c359c1d3fc6581b))
* **sales:** correct a completed bill's payment, who served and prescription detail within its open shift, with a review step, warnings and audit ([ac3ec9a](https://github.com/akvimal/rgp-bo/commit/ac3ec9aaecf4f6df11f6a88c68e24671aa027190))
* **sales:** family collector on staff credit, and pay later with a customer dues ledger ([18105ea](https://github.com/akvimal/rgp-bo/commit/18105ea9db8700844f723eb0318765f00947c24c))
* **settings:** export and import the business setup as JSON or Excel ([dd7edd5](https://github.com/akvimal/rgp-bo/commit/dd7edd5e3e9c0373d22fe680f87a3efae9c41f10))
* **shift:** closing a shift with a cash or digital difference asks why, for the cash and for each provider separately ([a13fcf7](https://github.com/akvimal/rgp-bo/commit/a13fcf7dc45b6613b58d25c5a992fca43a4e9503))
* **shifts:** record a forgotten drawer expense from the close-shift dialog ([92cff1b](https://github.com/akvimal/rgp-bo/commit/92cff1b73aa3662942889b80b9f2914eb71304da))
* **shift:** the opening float can be taken from the store's vault (manager only) ([86762aa](https://github.com/akvimal/rgp-bo/commit/86762aaa76282f556cb56a3cff74ea1f27d9d6c7))
* **shift:** the shift that fits the time of day is offered when opening, and the times are only a plan ([d68614c](https://github.com/akvimal/rgp-bo/commit/d68614cd918428e12d9deae6b3047270c0105c46))
* **stock:** adjust stock by saying remove or add first, with reasons for each direction ([f1edc1e](https://github.com/akvimal/rgp-bo/commit/f1edc1e50686dfb193e3f37e90d5935ae292512a))
* **store:** pay later can be switched off per store, apart from staff credit ([babf542](https://github.com/akvimal/rgp-bo/commit/babf542b6270169b31a10fbb94b33f662ca90413))
* **store:** staff credit can be switched off per store ([0767cf1](https://github.com/akvimal/rgp-bo/commit/0767cf1b07fc928294df30af94c0664a4cd8c1d1))
* **telegram:** message on every shift open and close with the sales summary (bills by staff, cash vs UPI/card, deliveries, expenses); switches under Settings &gt; Alerts ([972cbe0](https://github.com/akvimal/rgp-bo/commit/972cbe01929f77dbc768a574e646e16e42ebf53b))
* **todos:** list opens first, ticking takes a comment and files, needs-proof, and a floating quick-action button ([b5380f9](https://github.com/akvimal/rgp-bo/commit/b5380f92311899550965ac2ce5cc1213c48d617b))
* **todos:** to-do list with reminders through the alerts engine (phase 1) ([6e4225a](https://github.com/akvimal/rgp-bo/commit/6e4225a259e98a5a96d27e2d0ef03f0008411052))
* **ui:** customer on the delivery dialog title, sortable expiry grid, centred invoice pager ([22f13ab](https://github.com/akvimal/rgp-bo/commit/22f13ab25eda5239a4689cd73d857b2a3661e380))
* **ui:** light/dark theme switch (header button, user menu Light/Dark/Auto, remembered per person); login and counter screens stay light ([c3369a6](https://github.com/akvimal/rgp-bo/commit/c3369a6dd92419a08723579a7c0f86d737ffecb4))
* **ui:** move My shift, My HR and My KPI from the sidebar to the profile menu ([6be30a9](https://github.com/akvimal/rgp-bo/commit/6be30a93606a9c252fa9e681403da998c3738396))
* **ui:** one-row page head (title, tabs, actions) for Sales, Store, Purchase, Products, HR, Expenses, GST, Quality and Reports; compact page titles everywhere ([2c5ad4f](https://github.com/akvimal/rgp-bo/commit/2c5ad4f217b5b580bc64ecd44466c94896cc3794))
* **validation:** standard name pattern on customer, staff, login and vendor contact names, with shared patterns for business name, GSTIN, PAN, IFSC and pincode ([ace264e](https://github.com/akvimal/rgp-bo/commit/ace264e99c961160ee11526bf1f3e3fab1986ade))
* **vault:** Drop to vault button to put drawer cash in the vault during a shift ([9585f91](https://github.com/akvimal/rgp-bo/commit/9585f913837d7c5a08f2e7e77a7f25b10c1ca66d))
* **whatsapp:** send the bill to the customer on WhatsApp as a PDF, from each store's own number ([0a557b4](https://github.com/akvimal/rgp-bo/commit/0a557b429dfca7edc870ae93d235503d7ecf4399))
* **whatsapp:** the setup moves to Settings &gt; WhatsApp; Sell &gt; WhatsApp is the log ([2b1ef8b](https://github.com/akvimal/rgp-bo/commit/2b1ef8bd39f74f1bbb4887da9387ac042d4848f8))


### Bug Fixes

* **auth:** /secure/commitments opens for anyone with the sales permission (no role carried the path, so the guard sent them to login) ([2c053c1](https://github.com/akvimal/rgp-bo/commit/2c053c11466816ff5e7e19f0e2b30bbd0a15b211))
* **cash:** the store cash balance and the dashboard's cash tile now agree with the vault ([a0775ed](https://github.com/akvimal/rgp-bo/commit/a0775ed9df9b842bfbc805a457650dfe80241b15))
* **gst:** bill the purchase GST by default; dated rate changes override from their effective date ([254eb97](https://github.com/akvimal/rgp-bo/commit/254eb97c7b8df4d41d3b4da954d7b6afe01bef79))
* plain error messages, the price in force, and a product filter on purchase invoices ([c248c24](https://github.com/akvimal/rgp-bo/commit/c248c249924034cc9d6c816b35647338102878f0))
* **pos:** one entry point for the brand lookup - the Check brand button; remove the duplicate Find alternatives link ([5ce162e](https://github.com/akvimal/rgp-bo/commit/5ce162e60c6795a240d0e697165ef88b6c5571cb))
* **pos:** scope the product search stock to the billing store ([0510644](https://github.com/akvimal/rgp-bo/commit/0510644f1d354ad474adce3c292342a69940fd3a))
* **pos:** whole-number units, drafts complete onto the open shift, void permission in roles ([6039192](https://github.com/akvimal/rgp-bo/commit/60391929f641793fdc8d0cb463da528a18922dd3))
* **pricing:** take MRP, cost and GST from the newest verified purchase line ([9038e62](https://github.com/akvimal/rgp-bo/commit/9038e625e640bf9a6aae284274cdbe1046ebe5b8))
* **products:** the price dialog reads the same purchase as the pricing policy ([d44e3f4](https://github.com/akvimal/rgp-bo/commit/d44e3f4aeb21dbcd557141f0141fa5c17109a444))
* **purchases:** cash discount reaches the invoice GST figures, and removing a line rounds the total ([93642b3](https://github.com/akvimal/rgp-bo/commit/93642b3c0762c9d14d0cbd0a632ff4e87056a2f1))
* **purchases:** delete a draft invoice whose lines were sold on voided bills ([93f11e3](https://github.com/akvimal/rgp-bo/commit/93f11e3e55c37ec01dea28ae34c3cb55a4c4325a))
* **purchase:** show the order's lines on the invoice form as soon as the order is chosen ([6e6d789](https://github.com/akvimal/rgp-bo/commit/6e6d789a63340990ab51022d2b7cfa22490cbafa))
* **purchases:** invoice total includes GST ([8a54010](https://github.com/akvimal/rgp-bo/commit/8a540108a9ba24b62970122ef3cac519adaa6d4e))
* **purchases:** reorder stock leaves out expired batches and never goes below zero ([9f27b69](https://github.com/akvimal/rgp-bo/commit/9f27b693df8e1ce60b1a41dae61d3673ca70952c))
* **purchases:** the delivery challan panel is folded by default ([41bd16d](https://github.com/akvimal/rgp-bo/commit/41bd16d9ea978db380a31d2d7e7db96ea3516971))
* **purchases:** the rate-change reason can be given on verified lines ([2b068cf](https://github.com/akvimal/rgp-bo/commit/2b068cfec6e2b48a675bfcf3db84a72bbdaf05c0))
* **purchase:** tidy the assistant's invoice reading after the first real scan ([e723b10](https://github.com/akvimal/rgp-bo/commit/e723b10f837ab792da7b82b365396844de193513))
* **roles:** dark theme for the Edit Role form (permission cards were white with unreadable labels) ([79d4f11](https://github.com/akvimal/rgp-bo/commit/79d4f11243df860310ea18a611e5e42947bb5165))
* **sale:** flag unpriced products in the lookup and keep them off the bill; mixed-GST warning counts only in-date batches with stock ([b924edb](https://github.com/akvimal/rgp-bo/commit/b924edb13af07dd07428d47ec9b878475a1f282c))
* **sales:** a draft completed in the shift it was parked in puts its cash in the drawer ([b09f338](https://github.com/akvimal/rgp-bo/commit/b09f338dac1dec789da45bfbdd9db7c4d1ede4ec))
* **sales:** the Sales list footer totals add up every bill of the day, not just the first 50 ([6e8e7fa](https://github.com/akvimal/rgp-bo/commit/6e8e7fa25d64b55302c556c07b975d6292a07676))
* **sale:** the digital payment check asks what the statement shows ([3484785](https://github.com/akvimal/rgp-bo/commit/3484785927c5b895fa9a9d55b009bd50c1d0d2a1))
* **sale:** the product lookup shows the price the bill will charge, capped at the MRP ([36d9f69](https://github.com/akvimal/rgp-bo/commit/36d9f69d3ac6b6f49d069065c68ee199e69e059a))
* **scripts:** invoice totals check and fix tell before-tax and GST-inclusive invoices apart ([1d8c628](https://github.com/akvimal/rgp-bo/commit/1d8c62811665145e49beef77a2bb4a3c62e0cebf))
* **shifts:** "Fill from the drawer count" now sets the vault drop total ([8516b4a](https://github.com/akvimal/rgp-bo/commit/8516b4aee4c66db92cf2d8a54022d00afb44a27d))
* **shifts:** vault drop and visible errors in the Store &gt; Shifts close dialog ([175bd2b](https://github.com/akvimal/rgp-bo/commit/175bd2b1ee674339d568a5431d6df18a761a875a))
* **store:** hide the Transfers tab for single-store businesses ([2262f75](https://github.com/akvimal/rgp-bo/commit/2262f75b681d4bb4a41fa9a9b6582d2c2d940181))
* **store:** shift report lines add up to the expected closing cash ([5c50144](https://github.com/akvimal/rgp-bo/commit/5c501446558866094c3059a89a99a6e43f595ab9))
* **stores:** show the store selector for one-store businesses; weekly review signs the only store ([5b22c0e](https://github.com/akvimal/rgp-bo/commit/5b22c0e18a28612fd766c2122767a0944330ee5e))
* **store:** the Bills and Digital columns on Store &gt; Shifts show real figures ([6a65af4](https://github.com/akvimal/rgp-bo/commit/6a65af44de31aa14357be8dda5a975bb55af8cfe))
* **ui:** Customer orders link in the flat sidebar (it was only in the grouped menu) ([47900f5](https://github.com/akvimal/rgp-bo/commit/47900f5fe48da598ce391261ac88f3d7db230467))
* **ui:** dark theme audit of every screen - labels, dashboard chips, coloured table rows, filter buttons, bill preview as paper, blue/red text ([97e9707](https://github.com/akvimal/rgp-bo/commit/97e97075c62280d140fc917d67dc239c72eec57d))
* **ui:** dark theme for stock rows marked low or expired (styles.css uses !important) ([eb382aa](https://github.com/akvimal/rgp-bo/commit/eb382aab8cec0bf3ec75e23e25bc6247f84f744c))
* **ui:** dark theme for the customer history popup (bill rows and document cards) ([853b143](https://github.com/akvimal/rgp-bo/commit/853b14386b5e0a1b34dd74a882d35a2edde6aafd))
* **ui:** dark theme for the POS (inputs, bottom bar, total, product list) and brighter badges ([81202fb](https://github.com/akvimal/rgp-bo/commit/81202fb2710ea1e3e4dad398eb90bc644a8eacdf))
* **ui:** selects in compact forms keep room for their arrow ([ae8764d](https://github.com/akvimal/rgp-bo/commit/ae8764d7b9368f9278630cf5fbec72bc1eb92712))
* **users:** show why a user save is refused, and a script to link staff to their business ([ca70963](https://github.com/akvimal/rgp-bo/commit/ca709634038a7b2394c265f718c944c44587329d))
* **vault:** show the rupee sign on each denomination in "Notes and coins" ([ad28ed5](https://github.com/akvimal/rgp-bo/commit/ad28ed5b82abc6bf48035b151a3acf5bed16a28a))
* **vendors:** dropdowns list active vendors only, A to Z ([8a59ef9](https://github.com/akvimal/rgp-bo/commit/8a59ef951de6c09d5076c71c340874aa21524441))
* **whatsapp:** the WhatsApp entry was missing from the long-standing sidebar (only the grouped menu had it) ([ccf574f](https://github.com/akvimal/rgp-bo/commit/ccf574f70adadcfe46241cb793b8625bb4efd9f9))


### Reverts

* the sale bill formatting, footer template, WhatsApp copy and walk-in changes ([80e2fa7](https://github.com/akvimal/rgp-bo/commit/80e2fa7c9e4c3bf42d8d2430c1eb73e28a443318))

## [3.3.0](https://github.com/akvimal/rgp-bo/compare/v3.2.1...v3.3.0) (2026-11-03)


### Features

* **purchases:** cancel a sent purchase order (no invoice linked); Open on draft delete ([#170](https://github.com/akvimal/rgp-bo/issues/170)) ([5860d3a](https://github.com/akvimal/rgp-bo/commit/5860d3ae8977435c56d464019706dc50fe83f115))
* Reorder on-order tags, draft merge, Reorder search/sort; void a bill in its open shift ([#167](https://github.com/akvimal/rgp-bo/issues/167)) ([67fca49](https://github.com/akvimal/rgp-bo/commit/67fca49fe20c7ab5266c328534125f8112e9ae03))


### Bug Fixes

* **pos:** bill GST at today's rate; prescription panel chips; sale payload fix ([#166](https://github.com/akvimal/rgp-bo/issues/166)) ([f296c44](https://github.com/akvimal/rgp-bo/commit/f296c44669c98115f251ffb0adede44b02a67587))
* **stock:** measure the 30-day expiry rule from the last day of the expiry month ([#169](https://github.com/akvimal/rgp-bo/issues/169)) ([3686439](https://github.com/akvimal/rgp-bo/commit/36864397e8a9193a17da665ac27283e6442c64b7))

## [3.2.1](https://github.com/akvimal/rgp-bo/compare/v3.2.0...v3.2.1) (2026-11-02)


### Bug Fixes

* **cash:** show the Vault tab in a one-store business and refresh it after saving vault settings ([#163](https://github.com/akvimal/rgp-bo/issues/163)) ([556f9ee](https://github.com/akvimal/rgp-bo/commit/556f9ee5e1e5347279d990cdc00210ef1a1c3abe)), closes [#162](https://github.com/akvimal/rgp-bo/issues/162)

## [3.2.0](https://github.com/akvimal/rgp-bo/compare/v3.1.0...v3.2.0) (2026-11-02)


### Features

* **cash:** deposit alerts and dashboard read the vault; vault variance report ([#160](https://github.com/akvimal/rgp-bo/issues/160)) ([c552396](https://github.com/akvimal/rgp-bo/commit/c5523969f2b5d48ead10047cfbdf3dbcae61db6d))
* **cash:** drop the surplus into the vault when a shift closes at end of day ([#158](https://github.com/akvimal/rgp-bo/issues/158)) ([be6bd00](https://github.com/akvimal/rgp-bo/commit/be6bd00aee69ef1152f46dcfd2af7db1a1d8bd16)), closes [#152](https://github.com/akvimal/rgp-bo/issues/152)
* **cash:** vault API for drops, deposits, change, counts and adjustments ([#157](https://github.com/akvimal/rgp-bo/issues/157)) ([cf30611](https://github.com/akvimal/rgp-bo/commit/cf30611b38bbcfdb82c8943a6df3d5b73fee3388)), closes [#151](https://github.com/akvimal/rgp-bo/issues/151)
* **cash:** vault page, vault settings and the Vault tab ([#159](https://github.com/akvimal/rgp-bo/issues/159)) ([a2e8947](https://github.com/akvimal/rgp-bo/commit/a2e894712b51e7eaf288c84d07c43364ff3f4f6d))

## [3.1.0](https://github.com/akvimal/rgp-bo/compare/v3.0.0...v3.1.0) (2026-11-02)


### Features

* **cash:** schema for the store vault (migration 145) ([#156](https://github.com/akvimal/rgp-bo/issues/156)) ([dbd0e2b](https://github.com/akvimal/rgp-bo/commit/dbd0e2bc9a47bffbf3d0110a30472c76d4710f49)), closes [#150](https://github.com/akvimal/rgp-bo/issues/150)
