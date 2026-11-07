# Changelog

## [3.4.0](https://github.com/akvimal/rgp-bo/compare/v3.3.0...v3.4.0) (2026-11-07)


### Features

* **auth:** registered store PCs skip the authenticator and sign the Counter login in ([50b89a3](https://github.com/akvimal/rgp-bo/commit/50b89a32e4b4216288c1dda7b3e9b91a80c21d8f))
* **customers:** keep a customer without a mobile number, told apart by name and location ([f10ae6e](https://github.com/akvimal/rgp-bo/commit/f10ae6eb01a4e92ace39b3f147ad7b62786a24d5))
* **expenses:** category level and group, software categories, yearly repeats ([f96eddf](https://github.com/akvimal/rgp-bo/commit/f96eddfc8d16d92080d83ed54e2edeab57597e60))
* **prices:** price changes staff sheet ([18e11e9](https://github.com/akvimal/rgp-bo/commit/18e11e979e44dfd7827f38f59624f650728bd818))
* **purchases:** approval for payment of purchase invoices ([0600025](https://github.com/akvimal/rgp-bo/commit/0600025bc1053e165f7efb53300490dc0b88e29a))
* **purchases:** reorder screen help panel and a compact settings form ([be16a1b](https://github.com/akvimal/rgp-bo/commit/be16a1b1db9a0a255e6e7f1dfe4df53f25fd28cb))
* **purchases:** save a scanned invoice as a draft and check its lines one by one ([3660996](https://github.com/akvimal/rgp-bo/commit/366099676aedcfc27f1e3cb1f0851683e3953012))
* **purchases:** the payments panel under an invoice can be hidden ([8926d2b](https://github.com/akvimal/rgp-bo/commit/8926d2bd5d2c210d96bc18bf33edd211c0283529))
* **purchases:** vendor returns tracked separately and credited on a later invoice ([2633d56](https://github.com/akvimal/rgp-bo/commit/2633d562b6b7dafa4085a8ff011fba464972b40a))
* **sales:** Business Head can force-void a bill the ordinary void refuses ([3ac8ed5](https://github.com/akvimal/rgp-bo/commit/3ac8ed573fd83255eb552c83c8245b25b302af62))
* **sales:** change a completed bill to delivery, plus shift report and vendor rounding fixes ([daa0dd3](https://github.com/akvimal/rgp-bo/commit/daa0dd39ffd848380ad939d34c359c1d3fc6581b))
* **sales:** family collector on staff credit, and pay later with a customer dues ledger ([18105ea](https://github.com/akvimal/rgp-bo/commit/18105ea9db8700844f723eb0318765f00947c24c))
* **settings:** export and import the business setup as JSON or Excel ([dd7edd5](https://github.com/akvimal/rgp-bo/commit/dd7edd5e3e9c0373d22fe680f87a3efae9c41f10))
* **shifts:** record a forgotten drawer expense from the close-shift dialog ([92cff1b](https://github.com/akvimal/rgp-bo/commit/92cff1b73aa3662942889b80b9f2914eb71304da))
* **store:** pay later can be switched off per store, apart from staff credit ([babf542](https://github.com/akvimal/rgp-bo/commit/babf542b6270169b31a10fbb94b33f662ca90413))
* **store:** staff credit can be switched off per store ([0767cf1](https://github.com/akvimal/rgp-bo/commit/0767cf1b07fc928294df30af94c0664a4cd8c1d1))
* **todos:** to-do list with reminders through the alerts engine (phase 1) ([6e4225a](https://github.com/akvimal/rgp-bo/commit/6e4225a259e98a5a96d27e2d0ef03f0008411052))
* **vault:** Drop to vault button to put drawer cash in the vault during a shift ([9585f91](https://github.com/akvimal/rgp-bo/commit/9585f913837d7c5a08f2e7e77a7f25b10c1ca66d))


### Bug Fixes

* plain error messages, the price in force, and a product filter on purchase invoices ([c248c24](https://github.com/akvimal/rgp-bo/commit/c248c249924034cc9d6c816b35647338102878f0))
* **pos:** scope the product search stock to the billing store ([0510644](https://github.com/akvimal/rgp-bo/commit/0510644f1d354ad474adce3c292342a69940fd3a))
* **pos:** whole-number units, drafts complete onto the open shift, void permission in roles ([6039192](https://github.com/akvimal/rgp-bo/commit/60391929f641793fdc8d0cb463da528a18922dd3))
* **pricing:** take MRP, cost and GST from the newest verified purchase line ([9038e62](https://github.com/akvimal/rgp-bo/commit/9038e625e640bf9a6aae284274cdbe1046ebe5b8))
* **products:** the price dialog reads the same purchase as the pricing policy ([d44e3f4](https://github.com/akvimal/rgp-bo/commit/d44e3f4aeb21dbcd557141f0141fa5c17109a444))
* **purchases:** cash discount reaches the invoice GST figures, and removing a line rounds the total ([93642b3](https://github.com/akvimal/rgp-bo/commit/93642b3c0762c9d14d0cbd0a632ff4e87056a2f1))
* **purchases:** delete a draft invoice whose lines were sold on voided bills ([93f11e3](https://github.com/akvimal/rgp-bo/commit/93f11e3e55c37ec01dea28ae34c3cb55a4c4325a))
* **purchases:** invoice total includes GST ([8a54010](https://github.com/akvimal/rgp-bo/commit/8a540108a9ba24b62970122ef3cac519adaa6d4e))
* **purchases:** reorder stock leaves out expired batches and never goes below zero ([9f27b69](https://github.com/akvimal/rgp-bo/commit/9f27b693df8e1ce60b1a41dae61d3673ca70952c))
* **purchases:** the delivery challan panel is folded by default ([41bd16d](https://github.com/akvimal/rgp-bo/commit/41bd16d9ea978db380a31d2d7e7db96ea3516971))
* **purchases:** the rate-change reason can be given on verified lines ([2b068cf](https://github.com/akvimal/rgp-bo/commit/2b068cfec6e2b48a675bfcf3db84a72bbdaf05c0))
* **sales:** a draft completed in the shift it was parked in puts its cash in the drawer ([b09f338](https://github.com/akvimal/rgp-bo/commit/b09f338dac1dec789da45bfbdd9db7c4d1ede4ec))
* **scripts:** invoice totals check and fix tell before-tax and GST-inclusive invoices apart ([1d8c628](https://github.com/akvimal/rgp-bo/commit/1d8c62811665145e49beef77a2bb4a3c62e0cebf))
* **shifts:** "Fill from the drawer count" now sets the vault drop total ([8516b4a](https://github.com/akvimal/rgp-bo/commit/8516b4aee4c66db92cf2d8a54022d00afb44a27d))
* **shifts:** vault drop and visible errors in the Store &gt; Shifts close dialog ([175bd2b](https://github.com/akvimal/rgp-bo/commit/175bd2b1ee674339d568a5431d6df18a761a875a))
* **store:** hide the Transfers tab for single-store businesses ([2262f75](https://github.com/akvimal/rgp-bo/commit/2262f75b681d4bb4a41fa9a9b6582d2c2d940181))
* **store:** shift report lines add up to the expected closing cash ([5c50144](https://github.com/akvimal/rgp-bo/commit/5c501446558866094c3059a89a99a6e43f595ab9))
* **stores:** show the store selector for one-store businesses; weekly review signs the only store ([5b22c0e](https://github.com/akvimal/rgp-bo/commit/5b22c0e18a28612fd766c2122767a0944330ee5e))
* **ui:** selects in compact forms keep room for their arrow ([ae8764d](https://github.com/akvimal/rgp-bo/commit/ae8764d7b9368f9278630cf5fbec72bc1eb92712))
* **users:** show why a user save is refused, and a script to link staff to their business ([ca70963](https://github.com/akvimal/rgp-bo/commit/ca709634038a7b2394c265f718c944c44587329d))
* **vendors:** dropdowns list active vendors only, A to Z ([8a59ef9](https://github.com/akvimal/rgp-bo/commit/8a59ef951de6c09d5076c71c340874aa21524441))

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
