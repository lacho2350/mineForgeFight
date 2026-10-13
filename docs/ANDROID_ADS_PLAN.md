# Android release with rewarded ads — step by step

Written 2026-10-13. The concrete plan for putting Mine Forge Fight on **Google Play** with **rewarded ads**
(AdMob). The wider picture — every store, in-app purchases, fees — is in [RELEASE_PLAN.md](RELEASE_PLAN.md);
this file is the Android-and-ads part, in order, with what to change in this project. Store and ad rules
change: re-check the sources at the end before each step.

## The shape of it (decided 2026-10-13, built)

- **Free, with an ad every 3 minutes** — a full-screen (interstitial) ad at most every 3 minutes, shown
  only at a **natural pause**: going between the city and the mine, closing a pop-up, leaving a battle.
  AdMob forbids interstitials that pop up in the middle of play (they get ad accounts closed), so the ad
  waits for the next pause after the 3 minutes are up; none during a battle.
- **No more ads — €2**, bought once, kept (restorable on a new phone).
- **Packs of everything** — bought as often as wanted: **€1 → 1,000**, **€5 → 10,000**, **€20 →
  100,000** of gold *and* of every ore the mine yields, delivered whole even past the warehouse's limit.
- **Android first.** Both SDKs are native only: the web/PC build lists the shop but can't buy, and shows no ads.
- **Audience 13+** (not aimed at children), so the Families rules don't apply.
- Rewarded ads (watch an ad for a bonus) could be added later beside these — see the ideas below.

### What's built

| Piece | Where |
|---|---|
| Products, prices (shown where the store can't be reached), what each credits — once per store token | `src/game/shop.ts`, store action `creditPurchase` |
| `adsRemoved`, `creditedPurchases` in the save (older saves: ads on, nothing credited) | `src/game/state.ts`, `gameStore.ts` |
| Store: connect, local prices, buy, credit, finish (packs consumed, No more ads kept), collect unfinished purchases at start-up, restore | `src/components/purchases.ts` (expo-iap) |
| Ads: consent (Google's UMP form) → start → interstitial at pauses every 180 s, not in battles, not once removed; privacy choices | `src/components/ads.ts` (react-native-google-mobile-ads) |
| Web/PC twins that do nothing | `purchases.web.ts`, `ads.web.ts` |
| The shop in the Menu: the four products, restore, privacy choices | `src/components/ShopPanel.tsx` |
| Ad pauses | `adBreak()` in `index.tsx` (closing a pop-up, going down the mine), `mine.tsx` (up to the city), `battle.tsx` (leaving) |
| Config plugins (Google's **sample** app ids, measurement delayed until consent) | `app.json` |
| Tests | `__tests__/shop-test.ts` |

### Still to do before it can take money (yours, in the consoles)

(Click-by-click, with every form's answers and the test matrix: [NEXT_STEPS.md](NEXT_STEPS.md).)

1. **Play Console → Monetize → Products → In-app products**: create `remove_ads` (€2), `resources_1000`
   (€1), `resources_10000` (€5), `resources_100000` (€20) — the ids exactly as in `shop.ts`; set them
   *Active*. (Needs the payments profile; products can only be created once an app with billing has been
   uploaded — the first internal-testing build.)
2. **AdMob**: the app → its real **app id** into `app.json` (`androidAppId`, and `iosAppId` later); an
   **Interstitial** ad unit → its id into `RELEASE_INTERSTITIAL_ID` in `src/components/ads.ts` (until then
   release builds show no ads at all); publish the **GDPR message**.
3. **A development build** to try it for real (`npx expo install expo-dev-client`, then
   `npx eas-cli@latest build --platform android --profile development`) with **license testers** in Play
   Console (test cards: purchases go through, no money moves) and Google's test ads.

### Rewarded-ad ideas for later

Three rewards, each with a button that names it — AdMob requires the player to choose, with the reward
stated up front, and to be able to say no without losing anything:

| Button | Where | Reward |
|---|---|---|
| 📺 *Surveyors ready now* | mine screen, while the 🔦 SURVEY button is counting down | the survey cooldown ends at once |
| 📺 *Rush the builders* | a building's pop-up, while it's being built or upgraded | 60 s of work done on it at once (at most half of what's left) |
| 📺 *A merchant's purse* | the keep's pop-up (beside TAXES) | gold: 2 minutes of the current taxes |

- **Cap**: 5 rewarded ads a day across all three (by the device's date), and at least 2 minutes apart; the
  buttons say "come back tomorrow" when the cap is reached.
- **Never** during a battle, and never in place of anything the game needs to work.
- In the game's code this is pure TS like the rest of `src/game/`: a `rewards.ts` (the three kinds, the
  cap, `rewardProblem(state, kind, today)` and the amounts), a store action `claimAdReward(kind, today)`
  that applies one (only ever called after the ad says the reward was earned), and `adRewards: { day:
  string; count: number; last: number }` in the state (default for older saves: none used today).

## Steps

### 1. Accounts (week 1)

- **Google Play Console** — $25 once, identity check. A *personal* account must run a **closed test with
  12 testers for 14 days** before it can publish (an organisation account with a D-U-N-S number skips that).
- **AdMob** — free, sign in with the same Google account; payment details only when earnings arrive.
- **A small website** (GitHub Pages is enough) for the **privacy policy** and **`app-ads.txt`** (step 7).

### 2. Identifiers and build config

- `app.json` → `expo.android.package`, e.g. `"com.lacho.mineforgefight"` — **permanent once published**.
  Version names stay in `expo.version`; the Play version code is counted by EAS (below).
- Add `eas.json`:

  ```json
  {
    "cli": { "appVersionSource": "remote" },
    "build": {
      "development": { "developmentClient": true, "distribution": "internal" },
      "preview": { "distribution": "internal", "android": { "buildType": "apk" } },
      "production": { "autoIncrement": true }
    },
    "submit": { "production": {} }
  }
  ```

### 3. The libraries — done

- `react-native-google-mobile-ads` 17.2 and `expo-iap` 6.0 are installed (`npx expo install`) with their
  config plugins in `app.json`; the ads plugin carries **Google's sample app ids**
  (`ca-app-pub-3940256099942544~3347511713` Android, `~1458002511` iOS) and delays measurement until
  consent. Neither runs in Expo Go: to try them, add `expo-dev-client` (`npx expo install expo-dev-client`)
  and make a **development build**. (Adding it makes `npx expo start` open development builds by default —
  `npx expo start --go` still serves Expo Go.)
- **Test ads only while developing**: development builds use Google's test interstitial unit
  (`TestIds.INTERSTITIAL`, `ca-app-pub-3940256099942544/1033173712`). Clicking real ads on your own devices
  can get the AdMob account closed for invalid traffic.

### 4. The code — done

- `src/components/ads.ts`: consent first (`AdsConsent.gatherConsent()`; Google's form shows only where the
  law asks — the EEA, the UK, Switzerland), then `mobileAds().initialize()` only if `canRequestAds`; one
  `InterstitialAd`, loaded again after each close; `adBreak()` shows it at a pause when 180 s have passed,
  never in a battle, never once No more ads is bought. A PRIVACY CHOICES button in the shop re-opens the
  consent form where one is required.
- `src/components/purchases.ts`: `initConnection` → `fetchProducts` (local prices) → listeners; a purchase
  is credited only when *purchased* (pending ones wait), once per purchase token, then
  `finishTransaction` (`isConsumable` for the packs); unfinished purchases are collected at start-up and on
  RESTORE PURCHASES.
- `src/game/shop.ts` + `__tests__/shop-test.ts`: what each product gives, crediting once, older saves.

### 5. Try it (development build)

- `npx eas-cli@latest build --platform android --profile development` → install on the emulator
  (`~/Android`, AVD `mff_pixel`) and one real phone.
- Ads: the consent form (force it with the library's debug geography set to the EEA), then a test ad at
  the first pause after 3 minutes, none in a battle, none after buying No more ads; the game with no
  network (no ads, no errors).
- Purchases: with your Google account added as a **license tester** (Play Console → Settings → License
  testing) and an internal-testing build installed from Play: each product's purchase sheet shows the
  price; a pack credits once (kill the app mid-purchase and reopen: it's credited at start-up, not twice);
  No more ads survives reinstalling (RESTORE PURCHASES); a cancelled purchase changes nothing.

### 6. AdMob and Play Console set-up

- **AdMob → Apps → Add app** (Android; "not published yet" is fine — link it to the Play listing after
  launch). Its real **app id** (`ca-app-pub-…~…`) → `androidAppId` in `app.json`.
- **AdMob → Ad units → Interstitial** → its id into `RELEASE_INTERSTITIAL_ID` in `src/components/ads.ts`
  (until then release builds show no ads).
- **AdMob → Privacy & messaging → GDPR message**: publish it; this is what makes ads serve in the EEA, the
  UK and Switzerland.
- **Play Console → Monetize → Products → In-app products**: `remove_ads` €2, `resources_1000` €1,
  `resources_10000` €5, `resources_100000` €20 (ids exactly as in `shop.ts`), all *Active*; Play converts
  the euro prices for other countries (adjust per country if you like). Needs the **payments profile**
  (RELEASE_PLAN.md → Money) and a first build with billing uploaded to a testing track.

### 7. Privacy policy and app-ads.txt

- A privacy policy page: what the game stores (the save, on the device only), and that **Google AdMob**
  collects device identifiers (the advertising ID), IP address and ad interactions to show and measure
  ads, with a link to Google's own policy; how to reset or opt out (Android's ad ID settings, the in-game
  privacy choices).
- **`app-ads.txt`** at the root of the same website, with the line AdMob gives you
  (`google.com, pub-…, DIRECT, f08c47fec0942fa0`). The website must be the **developer website** in the
  Play listing, or AdMob can't verify the app.

### 8. Play Console: the app and its forms

- **Create app**: name, default language, *Game*, *Free*.
- **App content**:
  - *Privacy policy* URL (step 7).
  - *Ads*: **yes, contains ads** (shown on the listing). The listing also shows **In-app purchases**
    (it follows from the products).
  - *Data safety*: data **collected and shared** by the Mobile Ads SDK — device or other IDs (the
    advertising ID), approximate location from the IP address, app interactions, diagnostics — for
    advertising, analytics and fraud prevention; collected in transit encrypted; the save itself never
    leaves the device. Match the form to the SDK's own disclosure page (sources) and to the
    `com.google.android.gms.permission.AD_ID` permission the library adds.
  - *Target audience*: 13 and over. *Content rating*: the IARC questionnaire (fantasy combat, no blood —
    likely PEGI 7 / Everyone 10+).
  - *App access*: everything open, no login.
- **Store listing**: title, short (80 chars) and full description, 512×512 icon, 1024×500 feature graphic,
  phone screenshots (stronghold, mine, battle, prologue), category *Strategy*, contact email, the website.

### 9. Builds and testing tracks

- `npx eas-cli@latest build --platform android --profile production` → a signed `.aab` (EAS keeps the
  upload key; Play App Signing holds the release key).
- `npx eas-cli@latest submit --platform android` → the **internal testing** track (a Google service
  account key, set up once through EAS).
- **Closed testing**: 12+ testers opted in for **14 days** straight (friends, a Discord, a tester
  community). Collect their bugs; ship fixes as new builds (or over the air with EAS Update for JS-only
  changes).
- **Apply for production access** (the dashboard's three-part form about the test), then release with a
  **staged rollout** — 10% → 50% → 100%.

### 10. After launch

- Link the AdMob app to the Play listing; check **Policy center** in AdMob and **Policy status** in Play
  Console weekly at first.
- Watch the reward balance (the cap, the amounts) against how people play; change them in `rewards.ts`.
- Keep `react-native-google-mobile-ads` and Expo current — Play's yearly **target API** rule (API 36 now)
  and Google's SDK updates come with Expo SDK upgrades.

## Order and time

| When | What |
|---|---|
| Week 1 | Accounts (Play, AdMob), package id, `eas.json`, website with the privacy policy |
| Weeks 1–2 | Ads library, consent, `rewards.ts` + buttons + tests; development builds on the emulator and a phone |
| Week 2 | AdMob app + 3 rewarded units + GDPR message; `app-ads.txt`; store listing and the content forms |
| Week 3 | Production build → internal test → **closed test starts (14 days)** |
| Weeks 3–5 | Fixes from testers |
| Week 5 | Apply for production; staged rollout |

Fixed costs: **$25** (Play, once). AdMob and the website: free.

## Sources

- Google demo ad units (rewarded `…/5224354917`): https://developers.google.com/admob/android/test-ads ;
  sample app id: https://developers.google.com/admob/android/quick-start
- react-native-google-mobile-ads (Expo plugin, rewarded ads): https://www.npmjs.com/package/react-native-google-mobile-ads ;
  EU consent / `AdsConsent`: https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent
- AdMob rewarded ads: https://support.google.com/admob/answer/7372450 ; rules for rewards:
  https://support.google.com/admob/answer/7313578 ; consent in the EEA, UK, Switzerland:
  https://support.google.com/admob/answer/13554116 ; app-ads.txt: https://support.google.com/admob/answer/9363762
- The Mobile Ads SDK and Play's Data safety form: https://developers.google.com/admob/android/privacy/play-data-disclosure
- Google Play testing rule for new personal accounts: https://support.google.com/googleplay/android-developer/answer/14151465
- Expo: submitting to Google Play: https://docs.expo.dev/submit/android/
