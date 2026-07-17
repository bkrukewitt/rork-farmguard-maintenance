import { Linking, Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';

export const APP_STORE_URL = 'https://apps.apple.com/app/id6746048789';
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=app.rork.farmguardmaintenance';

export function getStoreListingUrl(): string {
  return Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
}

/** Native in-app review when available; otherwise open the store listing. */
export async function requestStoreReview(): Promise<void> {
  try {
    const available = await StoreReview.isAvailableAsync();
    if (available) {
      await StoreReview.requestReview();
      return;
    }
  } catch (error) {
    console.warn('[storeReview] requestReview failed, opening store URL', error);
  }

  try {
    await Linking.openURL(getStoreListingUrl());
  } catch (error) {
    console.warn('[storeReview] Could not open store URL', error);
  }
}
