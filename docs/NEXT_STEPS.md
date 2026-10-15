# Next steps — from here to Mine Forge Fight on Google Play, taking payments

Written 2026-10-13. Everything left between today's code and a released Android game that shows ads and
sells the four products, in the order to do it. Each step says **who** does it (🧑 you, in a console or
on a device · 🤖 code I can change), **exactly what** to click, type or paste, and **how to know it
worked**. Console menus get renamed now and then — if a label doesn't match, look for the nearest one.

Related: [ANDROID_ADS_PLAN.md](ANDROID_ADS_PLAN.md) (the design and what's built) ·
[RELEASE_PLAN.md](RELEASE_PLAN.md) (all stores, fees, iOS and PC) · [GAME_STATE.md](GAME_STATE.md) (the game).

---

## 0. Where things stand

**Built and tested** (web, Node tests, Expo Go on the Android emulator):

- The shop in the Menu (`ShopPanel`): **No more ads €2**, **1,000 / 10,000 / 100,000 of everything at
  €1 / €5 / €20** (gold + every mined ore, delivered whole). Purchases credited once each, finished with
  the store, unfinished ones collected at start-up, RESTORE PURCHASES (`src/game/shop.ts`,
  `src/components/purchases.ts` on **expo-iap 6.0** — Google Play Billing Library 9.1).
- Ads: Google's consent form first, then an **interstitial at most every 3 minutes at a natural pause**
  (city ↔ mine, closing a pop-up, leaving a battle), never in a battle, never after No more ads
  (`src/components/ads.ts` on **react-native-google-mobile-ads 17.2**).
- On the web and in Expo Go both are switched off safely (no native modules there).

**Not possible yet** — needs the steps below: real purchases (no Play Console products), real ads (no AdMob
ids), any native build (no package name, no EAS project, no `eas.json`).

**What you need**: a Google account for Play Console and AdMob, an Expo account (free), **$25** (one-time) for
Play Console, an Android phone (better than the emulator for the final checks), ~5 weeks of calendar time
(most of it is Google's 14-day closed test for new personal accounts).

---

## Part A — Code to finish first 🤖 — **done 2026-10-15** (branch `release-prep`), but for the 🧑 steps below

- A1 `com.lacho.mineforgefight` is in `app.json` (change it there before the first Play upload if you want another).
- A2 `eas.json` is written; **🧑 still to do:** `npx eas-cli@latest login` + `npx eas-cli@latest init` (writes `extra.eas.projectId`).
- A3 `expo-dev-client ~57.0.20` is in `package.json`; **🧑 run `npm install`** (the lockfile updates), then
  `npx expo-doctor` to confirm the version.
- A4 all four: any-side cottage doors (+ roads laid once more on load, `SAVE_VERSION` 6), the "Leave
  Greyhollow?" prompt, the mine's first blocks drawn before the screen opens, `DEBUG_CONSENT_AS_EEA` in `ads.ts`.

### A1. Choose the package name — permanent

- Format: reverse domain, lower case, e.g. **`com.lacho.mineforgefight`**. It can **never change** after
  the first upload to Play (the app's identity, its purchases and its reviews hang on it).
- Goes into `app.json`:

  ```json
  "android": { "package": "com.lacho.mineforgefight", … },
  "ios": { "bundleIdentifier": "com.lacho.mineforgefight", "supportsTablet": true }
  ```

- ✅ Check: `npx expo config --type public | grep -n package` prints it.

### A2. EAS project and `eas.json`

- 🧑 Make a free account at **expo.dev**, then in the project folder:

  ```bash
  npx eas-cli@latest login
  npx eas-cli@latest init
  ```

  `init` links the project to your account and writes `extra.eas.projectId` into `app.json`.
- 🤖 Add `eas.json`:

  ```json
  {
    "cli": { "version": ">= 16.0.0", "appVersionSource": "remote" },
    "build": {
      "development": { "developmentClient": true, "distribution": "internal", "android": { "buildType": "apk" } },
      "preview": { "distribution": "internal", "android": { "buildType": "apk" } },
      "production": { "autoIncrement": true }
    },
    "submit": { "production": { "android": { "track": "internal", "releaseStatus": "draft" } } }
  }
  ```

  - `appVersionSource: remote` + `autoIncrement`: EAS counts the Android **versionCode** up on every
    production build (Play refuses a repeated one). The visible version stays `expo.version` ("1.0.0") —
    raise it by hand for real releases (1.0.1, 1.1.0…).
  - `releaseStatus: draft`: uploads land as drafts you finish in Play Console (safer at first).

### A3. Development client

- 🤖 `npx expo install expo-dev-client`. From then on `npx expo start` serves **development builds**;
  Expo Go still works with `npx expo start --go`.

### A4. Small fixes worth doing before testers see it

- **Cottages packed four to a block** (only saves converted from the old 2×2 houses): the back row's doors
  face the front row, so no road can reach them and they stay unhappy. Fix: let a 1×1 cottage take its road
  on any side, and lay the missing roads once more on load.
- **Android Back on the bare map** leaves the app — add a "Leave Greyhollow?" prompt.
- **The mine's first look** shows black for a moment while its rock is drawn — draw the first blocks
  before showing the screen.
- Optional, for testing consent outside the EU: a development-only switch so the consent form behaves as
  in the EEA (`AdsConsent.gatherConsent({ debugGeography: AdsConsentDebugGeography.EEA })`).

---

## Part B — Accounts 🧑

### B1. Google Play Console (≈ 1–3 days, mostly Google's checks)

1. Go to **play.google.com/console/signup** with the Google account that will own the game.
2. Choose **Personal** (you) or **Organisation** (a registered business — needs a **D-U-N-S number**,
   free from Dun & Bradstreet, takes days to weeks). Personal is fine; its one catch is **B1-note** below.
3. Pay the **one-time $25** registration fee.
4. **Verify identity**: legal name, address, a government ID; the developer name you choose is shown
   publicly on the store. Personal accounts also verify a phone number and an Android device (the Play
   Console app on a phone).
5. ✅ Done when the Console's **Home** lets you **Create app**.

> **B1-note — new personal accounts must run a closed test with at least 12 testers, opted in for
> 14 days in a row, before they can publish to production.** Start recruiting testers now (Part H).

### B2. Payments profile (to sell anything)

1. Play Console → **Settings** (bottom of the left menu) → **Payments profile** → **Create payments profile**.
2. Legal business name (your own name for personal), a **street address (no PO box)**, the name shown on
   buyers' card statements (e.g. `MINEFORGEFIGHT`), a support email, website (Part F's site).
3. **Bank account** in the **same country** as the profile, then **verify** it (a small test deposit takes
   a few days). **Tax info** (in the EU: VAT number if you have one; Google collects and pays VAT on EU
   consumer sales itself).
4. ✅ Done when Settings → Payments profile shows it **verified**; *Monetize* pages stop asking for it.

### B3. AdMob

1. **admob.google.com** → sign in with the same Google account → country, time zone, billing currency.
2. Accept the terms. Payment details (where AdMob pays you) can wait until earnings reach the threshold.
3. ✅ Done when the AdMob home shows **Apps** in the left menu.

### B4. Expo (if not done in A2) — **expo.dev**; the free plan's monthly build allowance is enough to start (see expo.dev/pricing).

---

## Part C — The development build (try ads and the store on a device) 🧑 + 🤖

1. Build it in the cloud:

   ```bash
   npx eas-cli@latest build --platform android --profile development
   ```

   The first time, EAS asks to **generate a new Android keystore** — answer **yes** (EAS keeps it; this
   upload key is what Play recognises your builds by). The build takes ~10–20 min; the link it prints
   installs the APK.
2. Install: on the **emulator** drag the `.apk` onto it, or `~/Android/Sdk/platform-tools/adb install
   <file>.apk`; on a **phone** open the link and allow installing from the browser.
3. Run the code: `npx expo start` (dev client mode), open the app → it finds the Metro server (same Wi-Fi,
   or `adb reverse tcp:8081 tcp:8081` for the emulator / a USB phone).
4. Check **ads with Google's test unit** (development builds always use it):
   - The consent form appears only in the EEA/UK/Switzerland (or with A4's debug switch).
   - Play for **3+ minutes**, then go down the mine: a **test interstitial** ("Test Ad" label) shows; close
     it; the next comes only after another 3 minutes and at a pause.
   - Start a battle and leave it before 3 minutes: no ad. During a battle: never.
   - **Never click real ads** on your own devices — test ads only, or AdMob may close the account.
5. The **store won't work yet** in this build — Google only sells products of an app **uploaded to Play**
   and installed from it, after the products exist (Parts D and G). The shop shows the euro prices and
   "store can't be reached" until then.
6. ✅ Done when the game, the test ads and the consent behave as above on the emulator and one phone.

---

## Part D — Play Console: the app, its listing and its forms 🧑

### D1. Create the app

Play Console → **Home** → **Create app**:
- App name **Mine Forge Fight** (shown on the store, ≤ 30 characters), default language (English (UK) or
  (US)), **Game**, **Free**, accept the declarations (developer programme policies, US export laws).
- ✅ The app's **Dashboard** opens with "Set up your app" tasks.

### D2. App content (Dashboard → "Set up your app", or left menu **Policy and programs → App content**)

| Form | Answer for Mine Forge Fight |
|---|---|
| **Privacy policy** | the URL from Part F |
| **App access** | All functionality is available without special access (no login) |
| **Ads** | **Yes, my app contains ads** |
| **Content rating** | Category **Game**; questionnaire: fantasy violence (stylised battles, no blood or gore), no sexual content, no gambling, **in-app purchases: yes** (the store shows them anyway), no user interaction/chat, no location sharing → expect **PEGI 7 / ESRB Everyone 10+**-level ratings |
| **Target audience and content** | **13–15, 16–17, 18+** (not under 13 — keeps the Families policy out); "Could your app unintentionally appeal to children?" → No (a strategy game) |
| **News app** | No |
| **Data safety** | see D3 |
| **Government apps / Financial features / Health** | No / none / none |
| **Advertising ID** | **Yes, uses the advertising ID** — for **Advertising or marketing** and **Analytics** (the Mobile Ads SDK) |

### D3. Data safety (the longest form)

1. *Does your app collect or share any of the required user data types?* → **Yes** (the ads SDK does).
2. *Is all data encrypted in transit?* → **Yes**. *Can users request deletion?* → the save is only on the
   device (uninstalling deletes it); for ad data, point to Google's controls in the privacy policy.
3. Data types — **collected and shared**, processed **ephemerally: no**, **required: no** where the player
   can refuse consent (EEA) — purposes **Advertising or marketing**, **Analytics**, **Fraud prevention,
   security and compliance**:
   - **Device or other IDs** (the advertising ID, app set ID)
   - **App activity → App interactions** (ad views and clicks)
   - **App info and performance → Diagnostics**
   - **Location → Approximate location** (from the IP address)
4. **Not** collected by the game itself: the save, the purchases (Google handles payment details; the game
   keeps only purchase tokens on the device).
5. Re-check against Google's own disclosure for the Mobile Ads SDK (Sources) — it lists exactly what the
   SDK collects.
6. ✅ The Data safety preview matches the privacy policy; the **Advertising ID** form agrees with the
   `com.google.android.gms.permission.AD_ID` permission the ads library adds (Play warns if they disagree).

### D4. Store listing (left menu **Grow users → Store presence → Main store listing**)

| Item | Requirement | What to use |
|---|---|---|
| App name | ≤ 30 chars | Mine Forge Fight |
| Short description | ≤ 80 chars | e.g. *Mine the mountain, forge the gear, hold the walls against the Horde.* |
| Full description | ≤ 4,000 chars | the prologue's premise; the loop (mine → haul → forge → recruit → defend); roads, cottages, the river, sieges and field battles; "ads at pauses, removable; no pay-to-win timers" |
| App icon | 512 × 512 PNG, ≤ 1 MB | from `assets/icon.png` (1024²) scaled down |
| Feature graphic | 1024 × 500 JPG/PNG | the stronghold with the mine below, title text |
| Phone screenshots | 2–8, JPG/24-bit PNG, 320–3840 px, long side ≤ 2× short | stronghold, the mine full screen, a battle, the War panel, the prologue, the shop |
| Category / tags | Game → **Strategy** | tags: strategy, simulation, city building |
| Contact | email (required), website (Part F) | |

Screenshots: from the emulator with `~/Android/Sdk/platform-tools/adb exec-out screencap -p > shot.png`
(1080 × 2400 — fits the rules).

---

## Part E — Upload the first build and create the products 🧑 + 🤖

Products can only be created **after an app with billing has been uploaded** — so the first upload comes
before the shop items.

### E1. Service account key (lets EAS upload to Play)

1. **console.cloud.google.com** → create a project (e.g. `mineforgefight-play`).
2. **APIs & Services → Library** → enable **Google Play Android Developer API**.
3. **IAM & Admin → Service accounts → Create service account** (name `eas-submit`) → skip roles → Done.
4. Open it → **Keys → Add key → Create new key → JSON** → a `.json` file downloads. **Keep it secret**
   (never commit it).
5. Play Console → **Users and permissions → Invite new users** → paste the service account's email →
   **App permissions**: add Mine Forge Fight with **Release apps to testing tracks** (later also
   **Release to production**) → **Invite user**.
6. Give the key to EAS: `npx eas-cli@latest credentials --platform android` → production → *Google
   Service Account* → upload the JSON (or on expo.dev: **Credentials** → the app → **Service credentials**).

### E2. Production build → internal testing

```bash
npx eas-cli@latest build --platform android --profile production   # a signed .aab
npx eas-cli@latest submit --platform android --profile production  # to the internal track, as a draft
```

- Play Console → **Testing → Internal testing** → the draft release → add release notes → **Review release
  → Start rollout to Internal testing**. Add yourself (and any helpers) as **testers** (Testers tab → an
  email list) and open the **opt-in link** on the phone.
- ✅ The game installs **from Play** on your phone (the Play listing says "internal test").

### E3. Create the four products

Play Console → **Monetize with Play → Products → One-time products → Create one-time product**, four
times. The **Product ID must match the code exactly** (`src/game/shop.ts`):

| Product ID | Name (shown at checkout) | Description | Purchase option | Price |
|---|---|---|---|---|
| `remove_ads` | No more ads | Stops the ads between moments of play, for good. | Buy | **€2.00** |
| `resources_1000` | 1,000 of everything | 1,000 gold and 1,000 of every ore the mine yields. | Buy | **€1.00** |
| `resources_10000` | 10,000 of everything | 10,000 gold and 10,000 of every ore. | Buy | **€5.00** |
| `resources_100000` | 100,000 of everything | 100,000 gold and 100,000 of every ore. | Buy | **€20.00** |

- For each: add a **purchase option** (type *Buy*), set the price **in EUR** for all regions — Play
  converts it for other currencies (review a few, e.g. USD, GBP, BGN, and round them if you like).
  (Whether a product is consumed is decided by the code: packs are consumed after crediting, No more ads
  is only acknowledged — nothing to set for that in the Console beyond the product itself.)
- **Activate** each product (they're inactive when created).
- New products take **a few hours** to reach devices.
- ✅ On the internal-test install, the shop shows **Google's prices** (e.g. "€1.00", or your local
  currency) instead of the plain "€1", and the buttons are enabled.

### E4. License testers (buy without paying)

Play Console (account level) → **Settings → License testing** → add your Google account email (and your
helpers') → **Save**. On their phones, purchases then show **test cards** ("always approves", "always
declines", "slow approve/decline") — no money moves.
(Your own developer account counts as a tester automatically, but add it anyway; the phone must be signed
in with that same account.)

---

## Part F — The website: privacy policy and app-ads.txt 🧑 (+ 🤖 for the text)

1. Easiest host: **GitHub Pages** — a small public repo (e.g. `mineforgefight-site`) → Settings → Pages →
   deploy from the `main` branch → the site is `https://<your-user>.github.io/mineforgefight-site/`.
   A custom domain (~€10/year) looks better on the store and is needed if you want `app-ads.txt` at a
   domain's root (see 3).
2. **privacy.html** (I can write it) — what the game stores (its save, on the device only; uninstalling
   removes it), what **Google AdMob** collects (advertising ID, IP-based approximate location, ad
   interactions, diagnostics — for ads, measurement, fraud prevention), the consent form and **Privacy
   choices** in the Menu, purchases handled by **Google Play** (the game never sees card details), no
   accounts, no children's data, contact email, the date.
3. **app-ads.txt** at the **root of the website listed as the developer website on the Play listing**
   (e.g. `https://mineforgefight.com/app-ads.txt` — a github.io *project* page isn't a root, so use a
   custom domain or a `<user>.github.io` user site). One line, which AdMob shows you under **Apps → View
   all apps → app-ads.txt**:

   ```text
   google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
   ```

4. ✅ The privacy URL opens in a phone browser; AdMob's app-ads.txt page shows the file **found** (it can
   take a day to crawl).

---

## Part G — AdMob: the app, the ad unit, the consent message 🧑 → ids to 🤖

### G1. Add the app

AdMob → **Apps → Add app** → **Android** → "Is the app listed on a supported app store?" → **No** for now
(link it to the Play listing after launch: **App settings → Add app store details**) → name *Mine Forge
Fight* → **Add app**. Copy the **App ID** (`ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`).

### G2. The interstitial ad unit

**Apps → Mine Forge Fight → Ad units → Add ad unit → Interstitial → Select** → name `pause-interstitial`
→ (optional, a second guard besides the code) **Advanced settings → Frequency capping**: 1 impression
per 3 minutes → **Create ad unit**. Copy the **Ad unit ID** (`ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ`).

### G3. Put the ids in the code 🤖 (send them to me, or edit these two places)

- `app.json` → the `react-native-google-mobile-ads` plugin → `"androidAppId": "<App ID from G1>"` (keep
  the sample `iosAppId` until iOS).
- `src/components/ads.ts` → `RELEASE_INTERSTITIAL_ID.android = '<Ad unit ID from G2>'`. Until this is set,
  release builds show **no ads at all** (development builds always use Google's test unit).
- Then a **new production build** (E2) — app ids are baked into the native app.

### G4. The consent message (required for the EEA, the UK, Switzerland)

AdMob → **Privacy & messaging** → **European regulations** → **Create message** → select the app →
languages (English + any you translate to) → User choices: **Do not consent** on → Targeting: **Countries
subject to GDPR (EEA, UK and Switzerland)** → message name → **privacy policy URL** (Part F) → **Publish**.
(Optionally also the **US state regulations** message.)
✅ On a device with an EEA VPN or the debug switch (A4), the form appears at the first start; "Privacy
choices" shows in the Menu's shop.

---

## Part H — Closed test: 12 testers for 14 days (new personal accounts) 🧑

1. Recruit **at least 12** (aim for 15–20: some drop out) — friends and family with Android phones,
   a Discord or Reddit community (r/AndroidClosedTesting, r/TestersCommunity), tester exchange sites.
   They need a **Google account** and must **stay opted in all 14 days**.
2. Play Console → **Testing → Closed testing → Create track** (or use "Alpha") → **Testers**: an email
   list (their Gmail addresses) or a Google Group → **Create release** (promote the internal build:
   Internal testing → the release → **Promote release → Closed testing**) → rollout.
3. Send them the **opt-in link** (Testers tab → *How testers join your test*): open it on the phone →
   **Become a tester** → install from Play.
4. Ask them to **play a few times** over the two weeks and report bugs (a shared form or Discord channel);
   ship fixes as new production builds (E2 → promote) — JavaScript-only fixes can also go out over the air
   with **EAS Update** once you've set it up (`npx eas-cli@latest update:configure`).
5. Add them as **license testers** too (E4) if they should test purchases without paying.
6. After **14 days with ≥ 12 opted in**, Dashboard → **Apply for production** → a three-part form about
   the test (how you recruited, what feedback you got, what you changed), the app, and your readiness.
   Google answers in about a week.

---

## Part I — The test matrix (on the closed-test build, from Play) 🧑

**Purchases** (as a license tester):

| Do | Expect |
|---|---|
| Buy **1,000 of everything** with "always approves" | +1,000 gold and +1,000 of each ore at once; a thank-you notice; buyable again |
| Buy it again | credited again (a new purchase) |
| Buy, then **kill the app** during Google's screen, reopen | credited **once**, at start-up |
| "Slow test card, approves after a few minutes" | "Payment pending…", then the goods arrive by themselves |
| "Always declines" / back out of Google's sheet | nothing changes, no error spam |
| Buy **No more ads** | ads stop at once; the button shows ✓ |
| **Uninstall, reinstall**, RESTORE PURCHASES | No more ads comes back (packs don't — they were used) |
| Airplane mode, open the shop | "The store can't be reached…", buttons off, game fine |

**Ads** (release build, real unit — **look, don't click**):

| Do | Expect |
|---|---|
| Play 3+ minutes, go down the mine | one interstitial |
| Close pop-ups quickly for a minute after it | no second ad before 3 minutes |
| In a battle | never an ad |
| After No more ads | never an ad |
| Offline | no ads, no errors |

**General**: a cold start shows the save; the app in the background for an hour then back — the game
resumes; Android Back closes pop-ups; rotation stays portrait; a low-end phone stays playable.

---

## Part J — Release 🧑

1. Production access granted → **Production → Create new release** → promote the tested build → release
   notes ("First release") → countries (all, or start with a few) → **Staged rollout 20%** → after 2–3
   days without new crashes in **Android vitals**, **50%**, then **100%**.
2. AdMob → **App settings → Add app store details** → link the Play listing (ads earn better linked).
3. Watch weekly: Play Console **Policy status** and **Android vitals** (crash rate < 1.09%, ANR rate
   < 0.47%), AdMob **Policy center**, reviews (answer them).
4. Updates: JavaScript-only changes via **EAS Update** (same native build); anything native (new
   libraries, app ids, Expo SDK upgrades) needs a new build → internal → production.

---

## Part K — Later

- **iOS**: Apple Developer Program ($99/year), the products again in App Store Connect (same ids),
  `iosAppId` + an iOS ad unit, App Tracking Transparency text (`userTrackingUsageDescription`), App
  Privacy labels — see RELEASE_PLAN.md Phase 2.
- **PC (Steam/itch.io)**: the web build in Electron; no AdMob there — sell it as a paid game or with
  Steam's own purchases — RELEASE_PLAN.md Phase 3.
- **Crash reporting** (Sentry) before a wide launch; then add *Diagnostics* to the Data safety form.
- **Balance**: watch how the packs change play (100,000 of everything ends the early game at once); you
  may want sinks for late-game gold, or smaller packs.
- **Rewarded ads** (watch for a bonus) beside the interstitial — ideas in ANDROID_ADS_PLAN.md.

---

## Checklist

- [x] A1 package name chosen and set · [x] A2 `eas.json` (🧑 `eas init` still) · [x] A3 dev client (🧑 `npm install`) · [x] A4 fixes
- [ ] B1 Play Console verified · [ ] B2 payments profile verified · [ ] B3 AdMob · [ ] B4 Expo
- [ ] C development build tested (test ads, consent)
- [ ] D1 app created · [ ] D2 app content forms · [ ] D3 Data safety · [ ] D4 store listing
- [ ] E1 service account · [ ] E2 first build on internal testing · [ ] E3 four products active · [ ] E4 license testers
- [ ] F privacy policy live · [ ] F app-ads.txt found by AdMob
- [ ] G1 AdMob app · [ ] G2 interstitial unit · [ ] G3 ids in the code + new build · [ ] G4 consent message published
- [ ] H closed test: 12+ testers × 14 days → production applied → approved
- [ ] I test matrix passed
- [ ] J staged rollout to 100% · AdMob linked to the listing

## Timeline (if nothing waits long)

| Week | |
|---|---|
| 1 | A (code), B (accounts — payments profile verification runs in the background), F (website), C (dev build) |
| 2 | D (app, forms, listing), E (first build, products, license testers), G (AdMob ids → new build) |
| 2–4 | H closed test (14 days) + I test matrix, fixes |
| 4–5 | Apply for production → review (~1 week) |
| 5–6 | J staged rollout |

Fixed costs: **$25** (Play, once), **$0** Expo free tier, **$0** AdMob, website **$0–10/year**.
Google keeps a service fee on purchases (see RELEASE_PLAN.md → Money; check the current rates).

## Sources

- EAS Submit to Google Play (service account, first upload, `track`/`releaseStatus`): https://docs.expo.dev/submit/android/
- One-time products (formerly in-app products): https://support.google.com/googleplay/android-developer/answer/16430488 ; creating them: https://support.google.com/googleplay/android-developer/answer/1153481
- License testing: https://support.google.com/googleplay/android-developer/answer/6062777
- Closed-test requirement for new personal accounts: https://support.google.com/googleplay/android-developer/answer/14151465
- AdMob interstitial ad unit: https://support.google.com/admob/answer/7311435 ; GDPR message: https://support.google.com/admob/answer/10113207 ; app-ads.txt: https://support.google.com/admob/answer/9363762
- The Mobile Ads SDK and Play's Data safety form: https://developers.google.com/admob/android/privacy/play-data-disclosure
- Expo in-app purchases (expo-iap): https://docs.expo.dev/guides/in-app-purchases/ ; react-native-google-mobile-ads: https://docs.page/invertase/react-native-google-mobile-ads
