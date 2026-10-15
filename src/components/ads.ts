// Ads (Android and iOS builds with the Google Mobile Ads module): one full-screen ad at most every
// AD_INTERVAL_SECONDS of play, shown only at a natural pause in the game (`adBreak()`: going between the
// city and the mine, closing a pop-up, leaving a battle) — never in the middle of something — and never
// once No more ads is bought. Consent is gathered first (Google's form, where the law asks for one).
// Expo Go and builds without the module show none (`ads.web.ts`: the web never does).
import { Platform, TurboModuleRegistry } from 'react-native';
import { useGameStore } from '../game/gameStore';
import { AD_INTERVAL_SECONDS } from '../game/shop';

type AdsModule = typeof import('react-native-google-mobile-ads');

// The ad unit for release builds — replace with the real id from AdMob (Ad units → Interstitial) before
// publishing; until then release builds show no ads (development builds use Google's test unit).
const RELEASE_INTERSTITIAL_ID: Record<string, string> = {
  android: 'ca-app-pub-0000000000000000/0000000000',
  ios: 'ca-app-pub-0000000000000000/0000000000',
};

// Development only: have the consent form behave as in the EEA wherever the device is, to try it outside
// Europe (the emulator counts as a test device by itself; a real phone's hashed id goes in
// DEBUG_CONSENT_TEST_DEVICES — the Mobile Ads SDK logs it at start-up). `AdsConsent.reset()` from a dev
// menu would show the form again; release builds ignore both.
const DEBUG_CONSENT_AS_EEA: boolean = false;
const DEBUG_CONSENT_TEST_DEVICES: string[] = [];

let ads: AdsModule | null | undefined;
function adsModule(): AdsModule | null {
  if (ads !== undefined) return ads;
  // Only where the native module is in the app: Expo Go doesn't have it (loading the library there throws
  // as it loads, before any catch could keep the error quiet), and the game simply runs without ads.
  if (!TurboModuleRegistry.get('RNGoogleMobileAdsModule')) return (ads = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ads = require('react-native-google-mobile-ads') as AdsModule;
  } catch {
    ads = null;
  }
  return ads;
}

let started = false;
let interstitial: ReturnType<AdsModule['InterstitialAd']['createForAdRequest']> | null = null;
let loaded = false;
/** When the last ad closed (or the game started): the next waits AD_INTERVAL_SECONDS from here. */
let lastAdAt = Date.now();
let showPrivacyForm: (() => Promise<unknown>) | null = null;

/** Gather consent, start the SDK and load the first ad (once; does nothing without the module). */
export async function startAds() {
  if (started) return;
  started = true;
  const sdk = adsModule();
  if (!sdk) return;
  const unitId = __DEV__ ? sdk.TestIds.INTERSTITIAL : RELEASE_INTERSTITIAL_ID[Platform.OS];
  if (!unitId || unitId.includes('0000000000')) return;
  try {
    const consent = await sdk.AdsConsent.gatherConsent(
      __DEV__ && DEBUG_CONSENT_AS_EEA ? { debugGeography: sdk.AdsConsentDebugGeography.EEA, testDeviceIdentifiers: DEBUG_CONSENT_TEST_DEVICES } : {},
    );
    if (consent.privacyOptionsRequirementStatus === sdk.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED) {
      showPrivacyForm = () => sdk.AdsConsent.showPrivacyOptionsForm();
    }
    if (!consent.canRequestAds) return;
    await sdk.default().initialize();
    const ad = sdk.InterstitialAd.createForAdRequest(unitId);
    ad.addAdEventListener(sdk.AdEventType.LOADED, () => {
      loaded = true;
    });
    ad.addAdEventListener(sdk.AdEventType.CLOSED, () => {
      loaded = false;
      lastAdAt = Date.now();
      ad.load();
    });
    ad.addAdEventListener(sdk.AdEventType.ERROR, () => {
      loaded = false;
    });
    interstitial = ad;
    ad.load();
  } catch {
    // No consent form, no network, no fill: no ads this time.
  }
}

/**
 * A natural pause in play: show an ad if it's been AD_INTERVAL_SECONDS since the last one, one is
 * loaded, No more ads isn't bought and no battle is on. Otherwise nothing (cheap to call often).
 */
export function adBreak() {
  if (!interstitial || !loaded) return;
  const state = useGameStore.getState();
  if (state.adsRemoved || state.battle?.status === 'active') return;
  if (Date.now() - lastAdAt < AD_INTERVAL_SECONDS * 1000) return;
  loaded = false;
  interstitial.show().catch(() => {
    loaded = false;
  });
}

/** Where the law asks for it (the EEA, the UK, Switzerland), a way to change the ads consent; else null. */
export const privacyChoices = () => showPrivacyForm;
