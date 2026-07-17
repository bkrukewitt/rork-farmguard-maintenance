import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { SUPPORT_FEEDBACK_FORM_URL } from '@/constants/legalUrls';
import { useFarmData } from '@/contexts/FarmDataContext';
import { requestStoreReview } from '@/lib/storeReview';

const STORAGE_KEY = 'farmguard_rate_prompt';
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 600;

type RatePromptState = {
  lastDismissedAt?: string;
  respondedAt?: string;
};

async function loadState(): Promise<RatePromptState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as RatePromptState;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveState(next: RatePromptState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('[RateAppPrompt] Failed to persist state', error);
  }
}

function isEligibleForAutoPrompt(state: RatePromptState): boolean {
  if (state.respondedAt) return false;
  if (!state.lastDismissedAt) return true;
  const dismissedAt = Date.parse(state.lastDismissedAt);
  if (Number.isNaN(dismissedAt)) return true;
  return Date.now() - dismissedAt >= COOLDOWN_MS;
}

export const [RateAppPromptProvider, useRateAppPrompt] = createContextHook(() => {
  const { farmId, isDemoMode } = useFarmData();
  const [visible, setVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [state, setState] = useState<RatePromptState>({});
  const [loaded, setLoaded] = useState(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadState();
      if (!cancelled) {
        setState(stored);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
      }
    };
  }, []);

  const clearShowTimer = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }, []);

  const openModal = useCallback(() => {
    setRating(0);
    setVisible(true);
  }, []);

  /** Auto prompt after a happy moment (respects cooldown / responded). */
  const maybeShowRatePrompt = useCallback(() => {
    if (!loaded) return;
    if (!farmId || isDemoMode) return;
    if (!isEligibleForAutoPrompt(state)) return;

    clearShowTimer();
    showTimerRef.current = setTimeout(() => {
      openModal();
      showTimerRef.current = null;
    }, SHOW_DELAY_MS);
  }, [loaded, farmId, isDemoMode, state, clearShowTimer, openModal]);

  /** Settings entry — always shows the modal. */
  const showRatePrompt = useCallback(() => {
    clearShowTimer();
    openModal();
  }, [clearShowTimer, openModal]);

  const dismissNotNow = useCallback(async () => {
    clearShowTimer();
    setVisible(false);
    setRating(0);
    const next: RatePromptState = {
      ...state,
      lastDismissedAt: new Date().toISOString(),
    };
    setState(next);
    await saveState(next);
  }, [clearShowTimer, state]);

  const submitRating = useCallback(
    async (stars: number) => {
      clearShowTimer();
      setVisible(false);
      setRating(0);

      const next: RatePromptState = {
        ...state,
        respondedAt: new Date().toISOString(),
      };
      setState(next);
      await saveState(next);

      if (stars <= 3) {
        try {
          await Linking.openURL(SUPPORT_FEEDBACK_FORM_URL);
        } catch (error) {
          console.warn('[RateAppPrompt] Could not open feedback form', error);
        }
      } else {
        await requestStoreReview();
      }
    },
    [clearShowTimer, state]
  );

  return {
    visible,
    rating,
    setRating,
    maybeShowRatePrompt,
    showRatePrompt,
    dismissNotNow,
    submitRating,
  };
});
