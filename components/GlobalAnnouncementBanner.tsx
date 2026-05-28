import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Megaphone } from 'lucide-react-native';
import { trpc } from '@/lib/trpc';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Server-driven global announcement: modal on first view per session, plus optional top strip.
 * Super Admin publishes via Settings; data lives in Rork DB (tRPC backend).
 * Dismissing the modal does not dismiss the strip; each has its own dismiss for this session.
 */
export default function GlobalAnnouncementBanner() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [modalDismissed, setModalDismissed] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const { data } = trpc.farm.getGlobalAnnouncement.useQuery(undefined, {
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60 * 5,
    refetchOnMount: true,
  });

  const message = data?.active && data.message ? data.message : null;
  const endsAt = data?.endsAt;
  const active = Boolean(message);
  const showModal = active && !modalDismissed;
  const showBanner = active && !bannerDismissed;

  const handleDismissModal = useCallback(() => {
    setModalDismissed(true);
  }, []);

  const handleDismissBanner = useCallback(() => {
    setBannerDismissed(true);
  }, []);

  if (!active || !message) {
    return null;
  }

  return (
    <>
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleDismissModal}
        accessibilityViewIsModal
      >
        <Pressable
          style={[styles.modalBackdrop, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
          onPress={handleDismissModal}
          accessibilityRole="button"
          accessibilityLabel="Dismiss announcement backdrop"
        >
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={e => e.stopPropagation()}
            accessibilityRole="alert"
          >
            <View style={styles.modalHeaderRow}>
              <Megaphone color={colors.primary} size={22} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>Announcement</Text>
            </View>
            <Text style={[styles.modalBody, { color: colors.text }]}>{message}</Text>
            {endsAt ? (
              <Text style={[styles.modalMeta, { color: colors.textSecondary }]}>
                Until {new Date(endsAt).toLocaleString()}
              </Text>
            ) : null}
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={handleDismissModal}
              activeOpacity={0.85}
              accessibilityLabel="Got it, dismiss announcement dialog"
            >
              <Text style={[styles.modalButtonText, { color: colors.textOnPrimary }]}>Got it</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {showBanner ? (
        <View
          style={[
            styles.wrap,
            {
              paddingTop: Math.max(insets.top, 8),
              backgroundColor: colors.primary,
              borderBottomColor: colors.border,
            },
          ]}
          accessibilityRole="alert"
        >
          <View style={styles.row}>
            <Megaphone color={colors.textOnPrimary} size={18} style={styles.icon} />
            <Text style={[styles.text, { color: colors.textOnPrimary }]}>{message}</Text>
            <Pressable
              onPress={handleDismissBanner}
              hitSlop={12}
              accessibilityLabel="Dismiss announcement banner for this session"
            >
              <X color={colors.textOnPrimary} size={20} />
            </Pressable>
          </View>
          {endsAt ? (
            <Text style={[styles.meta, { color: colors.textOnPrimary + 'CC' }]}>
              Until {new Date(endsAt).toLocaleString()}
            </Text>
          ) : null}
        </View>
      ) : null}
    </>
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
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  modalMeta: {
    fontSize: 13,
    marginBottom: 16,
  },
  modalButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
  },
  icon: {
    marginTop: 2,
  },
  text: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  meta: {
    fontSize: 11,
    paddingHorizontal: 12,
    paddingBottom: 8,
    marginTop: -4,
  },
});
