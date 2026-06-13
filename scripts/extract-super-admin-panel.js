const fs = require('fs');
const lines = fs.readFileSync('app/(tabs)/settings.tsx', 'utf8').split(/\r?\n/);

const stateLines = lines.slice(157, 191);
const queryLines = lines.slice(233, 334);
const handlerLines = lines.slice(483, 697);
const jsxInner = lines.slice(2240, 2935); // skip header row, keep tabs + content

const header = `import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import {
  Shield,
  Users,
  Copy,
  X,
  Lock,
  ServerCrash,
  Zap,
  AlertTriangle,
  Download,
  Megaphone,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useFarmData, FarmMember } from '@/contexts/FarmDataContext';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { trpc } from '@/lib/trpc';
import { usePurchases } from '@/contexts/PurchasesContext';
import { useAdminAccess } from '@/contexts/AdminAccessContext';
import { buildSupportDebugText } from '@/utils/supportDebugInfo';
import PaywallModal from '@/components/PaywallModal';

type SuperAdminTab = 'danger' | 'members' | 'password' | 'recovery' | 'announce' | 'debug';

export default function SuperAdminPanel() {
  const { colors } = useTheme();
  const { effectiveSuperAdminPin, exitSuperAdmin } = useAdminAccess();
  const {
    equipment,
    maintenanceLogs,
    consumables,
    intervals,
    serviceRoutines,
    inspectionRoutines,
    farmId,
    deviceId,
    displayName,
    memberCount,
    lastSyncTime,
    deleteFarmFromServer,
    isDeletingFarm,
    forceDeleteEquipment,
    purgeAndResync,
    isPurging,
    isDemoMode,
  } = useFarmData();
  const {
    rcUserId,
    isSubscribed,
    isGrandfathered,
    isFarmLegacyPro,
    isTrial,
    trialDaysRemaining,
    customerInfo,
    isLoadingCustomerInfo,
    refreshFarmAccess,
  } = usePurchases();
  const [showPaywall, setShowPaywall] = useState(false);

`;

let body = stateLines.join('\n').replace(/type SuperAdminTab[^\n]+\n/, '');
body += '\n' + queryLines.join('\n')
  .replace(/const SUPER_ADMIN_PIN[^\n]+\n/g, '')
  .replace(/const DEBUG_PIN[^\n]+\n/g, '')
  .replace(/const effectiveSuperAdminPin[^\n]+\n/g, '');
body += '\n' + handlerLines.join('\n');

const mid = `
  const supportDebugSnapshot = useMemo(
    () => ({
      farmId,
      deviceId,
      displayName: displayName ?? '',
      memberCount,
      lastSyncTime,
      equipmentCount: equipment.length,
      maintenanceLogsCount: maintenanceLogs.length,
      consumablesCount: consumables.length,
      intervalsCount: intervals.length,
      serviceRoutinesCount: serviceRoutines.length,
      inspectionRoutinesCount: inspectionRoutines.length,
      isDemoMode,
      rcUserId,
      isSubscribed,
      isGrandfathered,
      isFarmLegacyPro,
      isTrial,
      trialDaysRemaining,
      customerInfo: customerInfo ?? null,
      isLoadingCustomerInfo,
    }),
    [
      farmId,
      deviceId,
      displayName,
      memberCount,
      lastSyncTime,
      equipment.length,
      maintenanceLogs.length,
      consumables.length,
      intervals.length,
      serviceRoutines.length,
      inspectionRoutines.length,
      isDemoMode,
      rcUserId,
      isSubscribed,
      isGrandfathered,
      isFarmLegacyPro,
      isTrial,
      trialDaysRemaining,
      customerInfo,
      isLoadingCustomerInfo,
    ],
  );

  const copySupportDebugInfo = useCallback(() => {
    const info = buildSupportDebugText(supportDebugSnapshot);
    void Clipboard.setStringAsync(info);
    Alert.alert('Copied', 'Support debug info copied to clipboard.');
  }, [supportDebugSnapshot]);

  return (
    <>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={[styles.superAdminHeader, { backgroundColor: colors.statusOverdue + '12' }]}>
            <Lock color={colors.statusOverdue} size={16} />
            <Text style={[styles.sectionTitle, { color: colors.statusOverdue, marginBottom: 0, flex: 1 }]}>Admin</Text>
            <TouchableOpacity onPress={exitSuperAdmin} hitSlop={8} accessibilityLabel="Lock admin">
              <Text style={{ color: colors.statusOverdue, fontWeight: '600', fontSize: 14 }}>Lock</Text>
            </TouchableOpacity>
          </View>
`;

const tail = `
        </View>
      </ScrollView>
      <PaywallModal visible={showPaywall} onDismiss={() => setShowPaywall(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 32 },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600' as const },
  superAdminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  superAdminTabScroll: { marginBottom: 12, maxHeight: 44 },
  superAdminTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  superAdminTabPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  superAdminTabText: { fontSize: 13, fontWeight: '600' as const },
  superAdminCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    gap: 10,
  },
  superAdminLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  superAdminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  superAdminButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' as const },
  debugText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  joinInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  joinInputText: { fontSize: 15, paddingVertical: 10 },
  farmIdErrorText: { fontSize: 13, marginTop: 4 },
  settingDescription: { fontSize: 12, marginTop: 2 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
  },
  memberInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontSize: 14, fontWeight: '600' as const },
  memberDetails: { flex: 1 },
  memberDeviceId: { fontSize: 14, fontWeight: '500' as const },
  memberBadges: { flexDirection: 'row', marginTop: 4 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  roleBadgeText: { fontSize: 11, fontWeight: '600' as const },
  memberJoinDate: { fontSize: 11, marginTop: 4 },
  copyButton: { padding: 8, borderRadius: 8 },
  removeMemberBtn: { padding: 8, borderRadius: 8 },
});
`;

const out = header + body + mid + jsxInner.join('\n') + tail;
fs.writeFileSync('components/SuperAdminPanel.tsx', out);
console.log('Wrote components/SuperAdminPanel.tsx');
