# Release plan: Google Play, Apple App Store and PC

Written 2026-10-12; payments and rewarded ads added 2026-10-13. Store rules change; the facts below were
checked on those dates (sources at the end).

## Where the game stands

- **Stack**: Expo SDK 57 (React Native 0.86, Expo Router, React Native Skia 2.6.2, Reanimated 4.5).
  SDK 57 targets Android API 36 and builds with Xcode 26.4 for iOS 16.4+, which already meets today's
  store rules (Google Play: target API 36 since 31 Aug 2026; Apple: built with Xcode 26 / the iOS 26 SDK
  since 28 Apr 2026). EAS Build uses the right Xcode on its own Macs — no Mac needed.
- **Run on Android once, on an emulator only** (2026-10-12, Expo Go on an API 36 Pixel image): the
  stronghold, placing, cottages, the mine, a battle, saving and Android's Back all worked; still to see:
  a real phone, an iPhone, and a low-end device's speed. Everything else was built and tested in the
  browser (Skia's web renderer, CanvasKit).
- **Not set up for the stores**: no `eas.json`, no Android `package` or iOS `bundleIdentifier` in
  `app.json`, version `1.0.0`, portrait only, `ios.supportsTablet: true`.
- **Legal**: `LICENSE` is still the Expo template's MIT licence with Expo's copyright — replace it with
  your own (or none, for a closed commercial game). The GitHub repo `lacho2350/mineForgeFight`: decide
  whether it stays public once the game is sold.
- **Game gaps a store player will notice**: no sound or music, no tutorial / first-time guidance, no
  settings screen, saves live only on the device (no cloud save), no crash reporting.
- **Web/PC specific**: the web build loads CanvasKit's `canvaskit.wasm` from the jsDelivr CDN
  (`GameScene.web.tsx`, `BattleBoard.web.tsx`, `MineScene.web.tsx`) — a desktop build must ship it inside
  the app so it works offline.

## Decisions to make first

1. **Identifiers** (permanent once published): e.g. `com.lacho.mineforgefight` for both
   `android.package` and `ios.bundleIdentifier`, and the store name ("Mine Forge Fight" must be free on
   both stores).
2. **Business model**: free, paid up front, free with in-app purchases, or ads (see **Money** below for
   what in-app purchases and rewarded ads take). This decides the store
   forms (privacy labels, data safety), extra libraries (store billing, an ads SDK), and on Steam any
   in-game purchase must go through the Steam Wallet. Simplest first release: **paid, or free with no
   purchases and no ads** — then the game collects no data and the privacy forms are trivial.
3. **Developer account type** (Google Play): a **personal** account created after 13 Nov 2023 must run a
   closed test with **12 testers opted in for 14 continuous days** before it may apply for production.
   An **organisation** account skips that, but needs a registered business and a D-U-N-S number.
4. **PC storefronts**: Steam (biggest reach, $100 per game), itch.io (free, good for an early demo /
   playtest), or both.

## Phase 0 — Make it releasable (all platforms, ~2–4 weeks)

1. **Run it on real phones.** Start with Expo Go (it bundles Skia, Reanimated and expo-sqlite), then a
   development build (`npx eas-cli@latest build --profile development`) on one mid-range Android phone
   and one iPhone. Check: the stronghold and mine canvases, battles, gestures (pan, pinch, drag-to-place),
   saving and loading, the app going to the background (`flushSave`), safe areas and notches.
2. **Performance on a low-end Android phone** (the web work cut per-tick cost and the castle-image
   freezes, but native Skia has its own costs: the still image uses an offscreen GPU surface there).
3. **Player-facing basics**: a short tutorial or first-hour hints, a settings screen (sound, music,
   reset save, credits / licences), sound effects and a music track, an app icon and splash that look
   finished (`assets/icon.png` 1024×1024, adaptive icon layers, `splash-icon.png`).
4. **Saves**: keep `SAVE_VERSION` migrations for every format change; consider a cloud save later
   (Google Play Games / iCloud / Steam Cloud).
5. **Crash reporting**: add Sentry (`npx expo install @sentry/react-native`, config plugin) — note it
   counts as "diagnostics" data in the privacy forms.
6. **Legal**: replace `LICENSE`; write a short **privacy policy** page (required by both stores even if
   you collect nothing — host it on GitHub Pages or EAS Hosting); list third-party licences in the app.
7. **App config** (`app.json`): `android.package`, `ios.bundleIdentifier`, `ios.buildNumber` /
   `android.versionCode` handled by EAS remote versioning, `ios.config.usesNonExemptEncryption: false`,
   `ios.privacyManifests` (Expo does **not** generate these reliably — add the required-reason API
   entries the libraries in `node_modules` declare, e.g. UserDefaults `CA92.1`), and for iPad either
   support all orientations or set `ios.requireFullScreen: true` (portrait-only iPad apps must opt out of
   multitasking) — or set `supportsTablet: false` to ship iPhone-only at first.
8. **`eas.json`** with three profiles — `development` (dev client), `preview` (internal installs), and
   `production` (`"autoIncrement": true` with `"cli": { "appVersionSource": "remote" }`, so every store
   build gets a new build number automatically).

## Phase 1 — Google Play (Android)

1. **Account**: Google Play Console, $25 one-time; identity verification.
2. **Create the app** in Play Console (name, default language, game, free/paid).
3. **Build**: `npx eas-cli@latest build --platform android --profile production` → a signed `.aab`
   (EAS creates and keeps the upload keystore; Play App Signing holds the release key).
4. **Upload**: `npx eas-cli@latest submit --platform android` — EAS can now make the first release on the
   **internal testing** track itself (needs a Google Service Account key, set up once through EAS).
5. **Closed test** (personal accounts): move the build to a closed testing track, invite **at least 12
   testers** (friends, a Discord, a tester community) and keep them opted in for **14 days**; fix what they
   find. Then **apply for production access** from the Play Console dashboard (a three-part form about the
   test, the app, and readiness).
6. **Store listing**: title, short (80 chars) and full description, 512×512 icon, 1024×500 feature
   graphic, at least 2 phone screenshots (plus 7"/10" tablet ones if you want tablet featuring), a
   category (Strategy / Simulation), contact email, privacy policy URL.
7. **Policy forms**: content rating (IARC questionnaire — fantasy combat, no blood → likely 7+/PEGI 7),
   **Data safety** (none collected if no analytics/ads; Sentry → diagnostics), target audience (not
   aimed at children unless you want the Families rules), ads declaration.
8. **Release**: production with a **staged rollout** (e.g. 10% → 50% → 100%); later updates either go
   through the store (`eas build` + `eas submit`) or, for JS-only fixes, **EAS Update** over the air.

## Money: in-app purchases and rewarded ads (Android first)

**The step-by-step Android plan with rewarded ads — what to change in this project, the AdMob and Play Console
set-up, the forms and the testing tracks — is in [ANDROID_ADS_PLAN.md](ANDROID_ADS_PLAN.md).**

**Decided and built (2026-10-13):** an interstitial ad at most every 3 minutes at natural pauses; *No more
ads* €2; packs of 1,000 / 10,000 / 100,000 of gold and every ore at €1 / €5 / €20 (expo-iap +
react-native-google-mobile-ads; what's left is console set-up — see ANDROID_ADS_PLAN.md).

Both need native modules, so neither runs in Expo Go: they need a development build
(`npx eas-cli@latest build --profile development`) and testing on a device (or the emulator, for ads).

### In-app purchases (Google Play Billing)

- **The rule**: digital goods sold in a Play-installed game must go through **Google Play Billing**, and
  since **31 Aug 2026 every new app and update must use Billing Library 8 or later** (an extension to
  1 Nov 2026 can be asked for on the Play Console's Policy status page; version 8 is accepted until
  31 Aug 2027). So start on a current library — don't pick anything still on 7.
- **Library** (the two the Expo guide names):
  - **`expo-iap`** (OpenIAP; `npx expo install expo-iap` + its config plugin). Android sits on Billing
    Library 9.1. Free; you keep the receipts and do your own server-side checks if you want them. API:
    `useIAP()` → `fetchProducts({ skus })` → `requestPurchase(…)` → `finishTransaction({ purchase,
    isConsumable })`. **Finish every purchase**: Google refunds one not acknowledged within 3 days.
    (`react-native-iap` was archived on 4 Aug 2026 — `expo-iap` is its successor.)
  - **RevenueCat** (`react-native-purchases`): a hosted layer over Play Billing and StoreKit —
    receipt checking, refunds, a dashboard, paywalls; a mock mode works in Expo Go for the UI. Free up to
    $2.5K tracked revenue a month, then 1% of it (on top of Google's fee).
  - Suggestion: `expo-iap` for a few one-off items (cheaper, no account); RevenueCat if subscriptions or
    serious analytics come later.
- **Play Console set-up**: a **payments profile** (legal name, a street address — no PO box, tax info,
  a bank account in the same country, verified), then the products under *Monetize → Products → In-app
  products* (ids like `gold_small`, `remove_ads`), each with a price. Test with **license testers** on an
  internal-testing build (test cards, no money moves).
- **Google's fee**: the Play help page (checked 2026-10-13) lists, for the first $1M a year in Australia,
  the EEA, Japan, the UK and the US, *10% + a 5% billing fee* on purchases by new installs and *25% + 5%*
  for existing installs, and *15%* in the other markets (30% above $1M); re-check before setting prices.
- **What fits Mine Forge Fight** (one-off, no pay-to-win pressure on a single-player game): a *Supporter
  pack* (cosmetic banner + a starting boost), *Remove ads* (if ads go in), and maybe small *gold* packs
  (consumables) — and keep the save/purchase in step: grant the item in the store's state only after
  `finishTransaction` succeeds, and re-grant non-consumables on every launch from the purchase history
  (`getAvailablePurchases`), since saves are local.

### Rewarded ads (AdMob)

- **Library**: **`react-native-google-mobile-ads`** (Invertase; `npx expo install
  react-native-google-mobile-ads` + its config plugin with `androidAppId` / `iosAppId`). Supports
  rewarded, rewarded interstitial, interstitial, banner, app-open and native ads.
- **AdMob account**: create the app and a *rewarded* ad unit; use Google's **test ad unit ids** while
  developing (real ads clicked in testing can get the account banned); add an `app-ads.txt` on the
  game's website.
- **Consent (required)**: for users in the **EEA, the UK and Switzerland** Google only serves
  personalised ads through a **Google-certified consent platform** — the simplest is Google's own UMP,
  built into the library as `AdsConsent` (`AdsConsent.gatherConsent()` before the first ad, then load ads
  only when `canRequestAds`; set `delayAppMeasurementInit` in the plugin). Without it, ads there are
  restricted.
- **AdMob's rules for rewards**: the player must **choose** to watch (a button naming the reward, e.g.
  *"Watch an ad: surveyors ready now"*), must be able to skip/decline without penalty, and must get the
  reward promised; **never real money** or anything transferable outside the game.
- **What fits the game**: a rewarded ad to *send the surveyors out again now* (resetting the survey
  cooldown), *finish a building a minute sooner*, *+N gold once an hour*, or *double the next barge's
  pay* — all capped (say 5 a day) so the game isn't balanced around them. No interstitials mid-battle.
- **Play Console forms when ads are in**: the **Ads** declaration ("contains ads" shows on the listing);
  **Data safety**: the Mobile Ads SDK collects and shares the **advertising ID**, other device
  identifiers, IP address, app interactions and diagnostics for advertising/analytics/fraud prevention —
  declare them (it adds the `com.google.android.gms.permission.AD_ID` permission; keep the form and the
  manifest in step); **target audience** 13+ unless you want the Families rules (then only
  Families-certified ad settings); the content rating questionnaire asks about ads too.
- On iOS the same library also asks App Tracking Transparency (`userTrackingUsageDescription` in the
  plugin) — that's Phase 2.

### Order

1. Decide: IAP only, ads only, or both (both = consent + Data safety work + a *Remove ads* item).
2. Development build with the library (or both); sandbox/test ids only.
3. Products in Play Console + license testers; AdMob app + rewarded unit + UMP message.
4. Internal test track → the closed test (Phase 1, step 5) with purchases and ads switched on.

## Phase 2 — Apple App Store (iOS / iPadOS)

1. **Account**: Apple Developer Program, $99/year (individual or organisation).
2. **App record** in App Store Connect with the bundle ID (EAS can register it for you).
3. **Build**: `npx eas-cli@latest build --platform ios --profile production` — EAS creates the
   distribution certificate and provisioning profile and builds on its Macs with Xcode 26.
4. **TestFlight**: `npx eas-cli@latest submit --platform ios` uploads it; after ~10–15 minutes of
   processing it can go to internal testers, and to external testers after a short beta review.
5. **Listing and forms**: screenshots for the 6.9" iPhone (and the 13" iPad if tablets stay supported),
   description, keywords, support URL, privacy policy URL, **App Privacy** labels ("Data Not Collected"
   if true), the **new age-rating questionnaire** (Apple's updated age ratings, required for all apps
   since 31 Jan 2026), category Games → Strategy/Simulation, export compliance (no non-exempt encryption).
6. **Submit for review** from App Store Connect (EAS Submit only uploads). Typical review: 1–3 days.
   Common rejections to pre-empt: crashes on launch, placeholder content, broken iPad layout, missing
   privacy policy, missing restore button if there are in-app purchases.
7. **Optional**: Game Center (leaderboards/achievements) needs its entitlement and setup in App Store
   Connect before submission; iCloud key-value storage for cloud saves.

## Phase 3 — PC (Windows, macOS, Linux / Steam Deck)

**Approach**: ship the game's web build (`npx expo export --platform web`) inside a desktop shell.
**Electron** is recommended over Tauri: it bundles Chromium — the browser the game was tuned and profiled
in (CanvasKit, WebGL, the Skia leak patch) — whereas Tauri uses each system's own web view (WebKitGTK on
Linux / Steam Deck), where WebGL and WebAssembly behaviour and speed vary. Electron's cost is a larger
download (~100 MB).

1. **Desktop build**: an Electron app that loads the exported `dist/` from disk; **bundle `canvaskit.wasm`**
   with it (point `locateFile` at the local file); landscape layout check (the stronghold and the mine
   already scale with the window); keyboard and mouse controls (the mine already has WASD and the wheel);
   a full-screen toggle; saves via `localStorage` in Electron's per-app storage, or files in the
   user-data folder (needed for **Steam Cloud**).
2. **Packaging**: electron-builder → Windows (NSIS installer or plain folder for Steam), macOS (signed
   and **notarised** with the Apple Developer account), Linux (AppImage/folder; test on a Steam Deck or
   with Proton).
3. **Steam**: Steamworks account and the **$100 Steam Direct fee** per game (recouped after $1,000 in
   sales). Store page (capsule images, screenshots, trailer recommended) — reviews take 3–5 business
   days, submit it **at least 7 business days** before you want it public; it must be live as **Coming
   Soon for at least 2 weeks** before launch (collect wishlists). Build review: also plan for 7 business
   days. Optional: achievements and Steam Cloud through steamworks.js.
4. **itch.io** (optional, free): upload the web build to be played in the browser and/or the Electron
   builds — a good place for an early demo and playtesting before Steam.

## Suggested order and timeline

| Weeks | What |
|---|---|
| 1 | Decide identifiers, business model, account types; open the Google, Apple (and Steam) accounts; replace LICENSE; privacy policy |
| 1–3 | Phase 0: first native builds, fix device issues, performance on a low-end phone, tutorial, sound, settings, icon/splash, Sentry |
| 3 | Android internal test → **start the 14-day closed test**; iOS TestFlight; Steam "Coming Soon" page submitted |
| 3–5 | Fix tester feedback; store listings, screenshots, rating and privacy forms; Electron desktop build |
| 5–6 | Apply for Google Play production access; submit iOS for review; Steam build review |
| 6+ | Launch (staged rollout on Android); EAS Update for quick JS fixes; Steam launch once the page has been up 2+ weeks |

Rough fixed costs to launch everywhere: $25 (Google, once) + $99/year (Apple) + $100 (Steam) — plus an
EAS plan if the free tier's build queue is too slow.

## What I can do next

- **The detailed to-do from here to release: [NEXT_STEPS.md](NEXT_STEPS.md).**
- Carry out [ANDROID_ADS_PLAN.md](ANDROID_ADS_PLAN.md): identifiers, `eas.json`, the ads library with consent, the
  three rewarded-ad bonuses (`rewards.ts`) and their buttons, then the first Android builds.
- Add the identifiers, `eas.json` profiles and remote versioning; replace the template LICENSE.
- Run the first development builds and fix whatever breaks on Android and iOS.
- Bundle CanvasKit locally and scaffold the Electron desktop app with electron-builder.
- A settings screen, a first-time tutorial, and a crash reporter.

## Sources

- Billing Library deadlines: https://developer.android.com/google/play/billing/deprecation-faq ; release notes: https://developer.android.com/google/play/billing/release-notes
- Expo in-app purchases guide (expo-iap, react-native-purchases): https://docs.expo.dev/guides/in-app-purchases/ ; expo-iap setup (Billing Library 9.1): https://openiap.dev/docs/setup/expo ; react-native-iap archived: https://github.com/hyochan/react-native-iap
- RevenueCat with Expo: https://www.revenuecat.com/docs/getting-started/installation/expo ; pricing (third-party summary): https://costbench.com/software/subscription-billing/revenuecat/
- Google Play service fees: https://support.google.com/googleplay/android-developer/answer/112622 ; payments profile: https://support.google.com/googleplay/android-developer/answer/7161426
- react-native-google-mobile-ads: https://www.npmjs.com/package/react-native-google-mobile-ads ; EU consent (AdsConsent / UMP): https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent
- AdMob rewarded ads: https://support.google.com/admob/answer/7372450 ; rules for rewards: https://support.google.com/admob/answer/7313578 ; consent requirements (EEA, UK, Switzerland): https://support.google.com/admob/answer/13554116
- Mobile Ads SDK and the Data safety form: https://developers.google.com/admob/android/privacy/play-data-disclosure

- Expo — submit to app stores: https://docs.expo.dev/deploy/submit-to-app-stores/ ; Android submission: https://docs.expo.dev/submit/android/ ; Apple privacy manifests: https://docs.expo.dev/guides/apple-privacy/ ; docs index: https://docs.expo.dev/llms.txt
- Expo SDK 57 (target API 36, iOS 16.4+, Xcode 26.4): https://expo.dev/changelog/sdk-57
- Google Play testing requirements for new personal accounts: https://support.google.com/googleplay/android-developer/answer/14151465
- Google Play target API level: https://developer.android.com/google/play/requirements/target-sdk
- Apple upcoming requirements (Xcode 26 / iOS 26 SDK from 28 Apr 2026; age ratings): https://developer.apple.com/news/upcoming-requirements/
- Steam Direct fee: https://partner.steamgames.com/doc/gettingstarted/appfee ; review process: https://partner.steamgames.com/doc/store/review_process ; Coming Soon page: https://partner.steamgames.com/doc/store/coming_soon
- Developer account fees (third-party summary): https://www.iconikai.com/blog/google-play-developer-account-fee-2026
