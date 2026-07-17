import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Star } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useRateAppPrompt } from '@/hooks/useRateAppPrompt';

export default function RateAppPrompt() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const {
    visible,
    rating,
    setRating,
    dismissNotNow,
    submitRating,
  } = useRateAppPrompt();

  const handleStarPress = useCallback(
    (stars: number) => {
      setRating(stars);
      void submitRating(stars);
    },
    [setRating, submitRating]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismissNotNow}
      accessibilityViewIsModal
    >
      <Pressable
        style={[
          styles.modalBackdrop,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
        onPress={dismissNotNow}
        accessibilityRole="button"
        accessibilityLabel="Dismiss rate app prompt"
      >
        <Pressable
          style={[
            styles.modalCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={(e) => e.stopPropagation()}
          accessibilityRole="alert"
        >
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            Enjoying FarmGuard?
          </Text>
          <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
            Tap a star to rate the app. Your feedback helps us improve.
          </Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((stars) => {
              const filled = stars <= rating;
              return (
                <TouchableOpacity
                  key={stars}
                  onPress={() => handleStarPress(stars)}
                  hitSlop={8}
                  accessibilityLabel={`Rate ${stars} star${stars === 1 ? '' : 's'}`}
                  accessibilityRole="button"
                >
                  <Star
                    size={36}
                    color={filled ? '#F5A623' : colors.border}
                    fill={filled ? '#F5A623' : 'transparent'}
                    strokeWidth={1.5}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.notNowButton}
            onPress={dismissNotNow}
            activeOpacity={0.7}
            accessibilityLabel="Not now"
          >
            <Text style={[styles.notNowText, { color: colors.textSecondary }]}>
              Not now
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
    textAlign: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  notNowButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  notNowText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
