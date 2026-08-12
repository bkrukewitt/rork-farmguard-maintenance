import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
  RefreshCw,
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
  const { enteredSuperAdminPin, exitSuperAdmin, isSuperAdmin } = useAdminAccess();
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

  const [deleteFarmIdInput, setDeleteFarmIdInput] = useState('');
  const [adminFarmIdLookup, setAdminFarmIdLookup] = useState<string>('');
  const [adminFarmMembers, setAdminFarmMembers] = useState<FarmMember[]>([]);
  const [isFetchingAdminMembers, setIsFetchingAdminMembers] = useState<boolean>(false);
  const [adminMembersError, setAdminMembersError] = useState<string>('');
  const [isUpdatingAdminMember, setIsUpdatingAdminMember] = useState<string | null>(null);
  const [superAdminFarmIdForPassword, setSuperAdminFarmIdForPassword] = useState<string>('');
  const [superAdminNewPassword, setSuperAdminNewPassword] = useState<string>('');
  const [superAdminNewPasswordConfirm, setSuperAdminNewPasswordConfirm] = useState<string>('');
  const [passwordAdminError, setPasswordAdminError] = useState<string>('');
  const [superAdminResetFarmId, setSuperAdminResetFarmId] = useState('');
  const [superAdminResetCode, setSuperAdminResetCode] = useState('');
  const [superAdminResetExpiresAt, setSuperAdminResetExpiresAt] = useState('');
  const [superAdminResetError, setSuperAdminResetError] = useState('');
  const [legacyProFarmId, setLegacyProFarmId] = useState('');
    const [superAdminTab, setSuperAdminTab] = useState<SuperAdminTab>('danger');
  const [auditFarmFilter, setAuditFarmFilter] = useState('');
  const [announceBody, setAnnounceBody] = useState('');
  const [announceDurationHours, setAnnounceDurationHours] = useState(48);
  const passwordProtectedFarmsQuery = trpc.farm.listPasswordProtectedFarms.useQuery(
    { superAdminPin: enteredSuperAdminPin },
    { enabled: isSuperAdmin }
  );

  const passwordResetAuditQuery = trpc.farm.listPasswordResetAuditEvents.useQuery(
    { superAdminPin: enteredSuperAdminPin, limit: 50 },
    { enabled: isSuperAdmin }
  );
  const refetchPasswordAudit = passwordResetAuditQuery.refetch;

  const filteredAuditEvents = useMemo(() => {
    const list = passwordResetAuditQuery.data?.events ?? [];
    const q = auditFarmFilter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((ev) => ev.farmId.toLowerCase().includes(q));
  }, [passwordResetAuditQuery.data?.events, auditFarmFilter]);

  useEffect(() => {
    if (!isSuperAdmin || superAdminTab !== 'recovery') return;
    void refetchPasswordAudit();
  }, [isSuperAdmin, superAdminTab, refetchPasswordAudit]);

  const forceSetFarmPasswordMutation = trpc.farm.forceSetFarmPassword.useMutation({
    onSuccess: () => {
      void passwordProtectedFarmsQuery.refetch();
      setPasswordAdminError('');
      setSuperAdminNewPassword('');
      setSuperAdminNewPasswordConfirm('');
      Alert.alert('Password Updated', `Join password updated for farm ${superAdminFarmIdForPassword.trim()}.`);
    },
    onError: (error) => {
      setPasswordAdminError(error.message || 'Failed to update farm password.');
    },
  });

  const superAdminGenerateResetCodeMutation = trpc.farm.superAdminGeneratePasswordResetCode.useMutation({
    onSuccess: (result) => {
      setSuperAdminResetCode(result.code);
      setSuperAdminResetExpiresAt(result.expiresAt);
      setSuperAdminResetError('');
      void passwordResetAuditQuery.refetch();
      Alert.alert(
        'Test Reset Code Generated',
        `Code: ${result.code}\nFarm: ${result.farmId}\nRecovery Email: ${result.recoveryEmail}`
      );
    },
    onError: (error) => {
      setSuperAdminResetError(error.message || 'Failed to generate test reset code.');
    },
  });

  const trpcUtils = trpc.useUtils();
  const globalAnnouncementPreviewQuery = trpc.farm.getGlobalAnnouncement.useQuery(undefined, {
    enabled: isSuperAdmin && superAdminTab === 'announce',
    staleTime: 30_000,
  });
  const superAdminSetAnnouncementMutation = trpc.farm.superAdminSetGlobalAnnouncement.useMutation({
    onSuccess: () => {
      void trpcUtils.farm.getGlobalAnnouncement.invalidate();
      setAnnounceBody('');
      Alert.alert('Published', 'Users will see this banner after their next refresh (within a few minutes).');
    },
    onError: (error) => {
      Alert.alert('Error', error.message || 'Failed to publish announcement.');
    },
  });
  const superAdminClearAnnouncementMutation = trpc.farm.superAdminClearGlobalAnnouncement.useMutation({
    onSuccess: () => {
      void trpcUtils.farm.getGlobalAnnouncement.invalidate();
      Alert.alert('Cleared', 'The global announcement has been removed.');
    },
    onError: (error) => {
      Alert.alert('Error', error.message || 'Failed to clear announcement.');
    },
  });

  const legacyProLookupQuery = trpc.farm.getFarmAccessFlags.useQuery(
    { farmId: legacyProFarmId.trim() },
    { enabled: isSuperAdmin && legacyProFarmId.trim().length > 0 },
  );

  const superAdminSetLegacyProMutation = trpc.farm.superAdminSetLegacyPro.useMutation({
    onSuccess: (data) => {
      void legacyProLookupQuery.refetch();
      if (farmId === legacyProFarmId.trim()) {
        void refreshFarmAccess(farmId);
      }
      Alert.alert(
        'Updated',
        data.legacyPro
          ? `Farm ${legacyProFarmId.trim()} now has legacy Pro access.`
          : `Legacy Pro removed for farm ${legacyProFarmId.trim()}.`,
      );
    },
    onError: (error) => {
      Alert.alert('Error', error.message || 'Failed to update legacy Pro flag.');
    },
  });
  const handleFetchAdminFarmMembers = async () => {
    const targetId = adminFarmIdLookup.trim();
    if (!targetId) {
      setAdminMembersError('Enter a Farm ID to look up.');
      return;
    }
    setIsFetchingAdminMembers(true);
    setAdminMembersError('');
    setAdminFarmMembers([]);
    try {
      const { data, error } = await supabase
        .from('farm_members')
        .select('*')
        .eq('farm_id', targetId)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) {
        setAdminMembersError('No members found for this Farm ID.');
      } else {
        setAdminFarmMembers(data as FarmMember[]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch members.';
      setAdminMembersError(msg);
    } finally {
      setIsFetchingAdminMembers(false);
    }
  };

  const handleSelectPasswordFarm = useCallback((targetFarmId: string) => {
    setSuperAdminFarmIdForPassword(targetFarmId);
    setPasswordAdminError('');
  }, []);

  const handleForceSetFarmPassword = useCallback(async () => {
    const targetId = superAdminFarmIdForPassword.trim();
    const pw = superAdminNewPassword.trim();
    const confirm = superAdminNewPasswordConfirm.trim();

    if (!targetId) {
      setPasswordAdminError('Enter a Farm ID.');
      return;
    }
    if (!pw) {
      setPasswordAdminError('Enter a new password.');
      return;
    }
    if (pw.length < 4) {
      setPasswordAdminError('Password must be at least 4 characters.');
      return;
    }
    if (pw !== confirm) {
      setPasswordAdminError('Passwords do not match.');
      return;
    }

    setPasswordAdminError('');
    await forceSetFarmPasswordMutation.mutateAsync({
      superAdminPin: enteredSuperAdminPin,
      farmId: targetId,
      newPassword: pw,
    });
  }, [
    enteredSuperAdminPin,
    forceSetFarmPasswordMutation,
    superAdminFarmIdForPassword,
    superAdminNewPassword,
    superAdminNewPasswordConfirm,
  ]);

  const handleGenerateTestResetCode = useCallback(async () => {
    const targetId = superAdminResetFarmId.trim();
    if (!targetId) {
      setSuperAdminResetError('Enter a Farm ID.');
      return;
    }
    setSuperAdminResetError('');
    await superAdminGenerateResetCodeMutation.mutateAsync({
      superAdminPin: enteredSuperAdminPin,
      farmId: targetId,
    });
  }, [enteredSuperAdminPin, superAdminGenerateResetCodeMutation, superAdminResetFarmId]);

  const handleAdminChangeRole = async (member: FarmMember) => {
    const newRole = member.role === 'admin' ? 'member' : 'admin';
    setIsUpdatingAdminMember(member.device_id);
    try {
      const { error } = await supabase
        .from('farm_members')
        .update({ role: newRole })
        .eq('farm_id', member.farm_id)
        .eq('device_id', member.device_id);
      if (error) throw error;
      setAdminFarmMembers(prev =>
        prev.map(m => m.device_id === member.device_id ? { ...m, role: newRole } : m)
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update role.';
      Alert.alert('Error', msg);
    } finally {
      setIsUpdatingAdminMember(null);
    }
  };

  const handleAdminDeleteMember = (member: FarmMember) => {
    Alert.alert(
      'Remove Member',
      `Remove ${member.display_name || member.device_id.slice(0, 12)} from farm ${member.farm_id}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsUpdatingAdminMember(member.device_id);
            try {
              const { error } = await supabase
                .from('farm_members')
                .delete()
                .eq('farm_id', member.farm_id)
                .eq('device_id', member.device_id);
              if (error) throw error;
              setAdminFarmMembers(prev => prev.filter(m => m.device_id !== member.device_id));
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Failed to remove member.';
              Alert.alert('Error', msg);
            } finally {
              setIsUpdatingAdminMember(null);
            }
          },
        },
      ]
    );
  };

  const handleDeleteFarmFromServer = useCallback(() => {
    const targetId = deleteFarmIdInput.trim();
    if (!targetId) {
      Alert.alert('Error', 'Please enter a Farm ID to delete.');
      return;
    }
    Alert.alert(
      'Delete Farm from Server',
      `This will permanently delete farm "${targetId}" and ALL its data (members, equipment, logs, etc.) from the server. This CANNOT be undone.\n\nAre you absolutely sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFarmFromServer(targetId);
              setDeleteFarmIdInput('');
              Alert.alert('Deleted', `Farm "${targetId}" has been permanently removed from the server.`);
            } catch (error) {
              console.error('[SuperAdmin] Delete farm error:', error);
              const msg = error instanceof Error ? error.message : 'Unknown error';
              Alert.alert('Error', `Failed to delete farm: ${msg}`);
            }
          },
        },
      ]
    );
  }, [deleteFarmIdInput, deleteFarmFromServer]);

  const handleForceDeleteAllEquipment = useCallback(() => {
    if (equipment.length === 0) {
      Alert.alert('No Equipment', 'There is no equipment to delete.');
      return;
    }
    Alert.alert(
      'Force Delete All Equipment',
      `This will force-delete ALL ${equipment.length} equipment items, their logs, and intervals from local storage AND push to server. Cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await forceDeleteEquipment(equipment.map(e => e.id));
              Alert.alert('Done', 'All equipment force-deleted and synced.');
            } catch (error) {
              console.error('[SuperAdmin] Force delete equipment error:', error);
              Alert.alert('Error', 'Failed to force delete equipment.');
            }
          },
        },
      ]
    );
  }, [equipment, forceDeleteEquipment]);

  const handlePurgeAndResync = useCallback(() => {
    Alert.alert(
      'Purge & Resync',
      'This will DELETE all local data and replace it with whatever is on the server. If no server data exists, everything will be empty. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purge & Resync',
          style: 'destructive',
          onPress: async () => {
            try {
              await purgeAndResync();
              Alert.alert('Done', 'Local data purged and resynced from server.');
            } catch (error) {
              console.error('[SuperAdmin] Purge error:', error);
              Alert.alert('Error', 'Failed to purge and resync.');
            }
          },
        },
      ]
    );
  }, [purgeAndResync]);
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.superAdminTabScroll}
            contentContainerStyle={styles.superAdminTabRow}
          >
            {([
              { id: 'danger' as SuperAdminTab, label: 'Danger' },
              { id: 'members' as SuperAdminTab, label: 'Members' },
              { id: 'password' as SuperAdminTab, label: 'Passwords' },
              { id: 'recovery' as SuperAdminTab, label: 'Recovery' },
              { id: 'announce' as SuperAdminTab, label: 'Announce' },
              { id: 'debug' as SuperAdminTab, label: 'Debug' },
            ]).map(({ id, label }) => {
              const active = superAdminTab === id;
              return (
                <TouchableOpacity
                  key={id}
                  style={[
                    styles.superAdminTabPill,
                    {
                      backgroundColor: active ? colors.primary : colors.background,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSuperAdminTab(id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.superAdminTabText, { color: active ? '#fff' : colors.text }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {superAdminTab === 'danger' && (
          <>
          <View style={[styles.superAdminCard, { backgroundColor: colors.surface, borderColor: colors.statusOverdue + '30' }]}>
            <Text style={[styles.superAdminLabel, { color: colors.textSecondary }]}>Delete Farm from Server</Text>
            <View style={[styles.joinInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput
                style={[styles.joinInputText, { color: colors.text }]}
                placeholder="Enter Farm ID to delete"
                placeholderTextColor={colors.textSecondary}
                value={deleteFarmIdInput}
                onChangeText={setDeleteFarmIdInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <TouchableOpacity
              style={[styles.superAdminButton, { backgroundColor: colors.statusOverdue }]}
              onPress={handleDeleteFarmFromServer}
              disabled={isDeletingFarm}
            >
              {isDeletingFarm ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <ServerCrash color="#fff" size={16} />
                  <Text style={styles.superAdminButtonText}>Delete Farm from Server</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={[styles.superAdminCard, { backgroundColor: colors.surface, borderColor: colors.statusOverdue + '30' }]}>
            <Text style={[styles.superAdminLabel, { color: colors.textSecondary }]}>Force Actions</Text>

            <TouchableOpacity
              style={[styles.superAdminButton, { backgroundColor: colors.statusOverdue + 'CC' }]}
              onPress={handleForceDeleteAllEquipment}
            >
              <Zap color="#fff" size={16} />
              <Text style={styles.superAdminButtonText}>Force Delete All Equipment ({equipment.length})</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.superAdminButton, { backgroundColor: colors.accent }]}
              onPress={handlePurgeAndResync}
              disabled={isPurging}
            >
              {isPurging ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <AlertTriangle color="#fff" size={16} />
                  <Text style={styles.superAdminButtonText}>Purge Local & Resync from Server</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          </>
          )}

          {superAdminTab === 'members' && (
          <View style={[styles.superAdminCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.superAdminLabel, { color: colors.textSecondary }]}>Farm Member Manager</Text>
            <View style={[styles.joinInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput
                style={[styles.joinInputText, { color: colors.text }]}
                placeholder="Enter Farm ID to look up"
                placeholderTextColor={colors.textSecondary}
                value={adminFarmIdLookup}
                onChangeText={setAdminFarmIdLookup}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {adminMembersError ? (
              <Text style={[styles.farmIdErrorText, { color: colors.statusOverdue }]}>{adminMembersError}</Text>
            ) : null}
            <TouchableOpacity
              style={[styles.superAdminButton, { backgroundColor: colors.primary }]}
              onPress={handleFetchAdminFarmMembers}
              disabled={isFetchingAdminMembers}
            >
              {isFetchingAdminMembers ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Users color="#fff" size={16} />
                  <Text style={styles.superAdminButtonText}>Fetch Members</Text>
                </>
              )}
            </TouchableOpacity>
            {adminFarmMembers.length > 0 && (
              <View style={{ gap: 8, marginTop: 8 }}>
                <Text style={[styles.superAdminLabel, { color: colors.textSecondary }]}>
                  {adminFarmMembers.length} member{adminFarmMembers.length !== 1 ? 's' : ''}
                </Text>
                {adminFarmMembers.map((member: FarmMember) => (
                  <View key={member.device_id} style={[styles.memberRow, { backgroundColor: colors.background }]}>
                    <View style={styles.memberInfo}>
                      <View style={[styles.memberAvatar, { backgroundColor: colors.primary + '20' }]}>
                        <Text style={[styles.memberAvatarText, { color: colors.primary }]}>
                          {(member.display_name || member.device_id).charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.memberDetails}>
                        <Text style={[styles.memberDeviceId, { color: colors.text }]} numberOfLines={1}>
                          {member.display_name || `Device ${member.device_id.slice(0, 10)}`}
                        </Text>
                        <View style={styles.memberBadges}>
                          <View style={[styles.roleBadge, { backgroundColor: member.role === 'admin' ? colors.primary + '20' : colors.border }]}>
                            <Text style={[styles.roleBadgeText, { color: member.role === 'admin' ? colors.primary : colors.textSecondary }]}>
                              {member.role === 'admin' ? 'Admin' : 'Member'}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.memberJoinDate, { color: colors.textSecondary }]}>
                          Last active: {new Date(member.last_active_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        style={[styles.copyButton, { backgroundColor: colors.accent + '20' }]}
                        onPress={() => handleAdminChangeRole(member)}
                        disabled={isUpdatingAdminMember === member.device_id}
                      >
                        {isUpdatingAdminMember === member.device_id ? (
                          <ActivityIndicator size="small" color={colors.accent} />
                        ) : (
                          <Shield color={colors.accent} size={14} />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.removeMemberBtn, { backgroundColor: colors.statusOverdue + '20' }]}
                        onPress={() => handleAdminDeleteMember(member)}
                        disabled={isUpdatingAdminMember === member.device_id}
                      >
                        <X color={colors.statusOverdue} size={14} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
          )}

          {superAdminTab === 'password' && (
          <View style={[styles.superAdminCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.superAdminLabel, { color: colors.textSecondary }]}>Farm Password Manager</Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary, marginBottom: 8 }]}>
              View farms with join passwords and force-change one.
            </Text>

            <View style={[styles.joinInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput
                style={[styles.joinInputText, { color: colors.text }]}
                placeholder="Enter or select Farm ID"
                placeholderTextColor={colors.textSecondary}
                value={superAdminFarmIdForPassword}
                onChangeText={(t) => {
                  setSuperAdminFarmIdForPassword(t);
                  setPasswordAdminError('');
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={[styles.joinInput, { backgroundColor: colors.background, borderColor: colors.border, marginTop: 8 }]}>
              <TextInput
                style={[styles.joinInputText, { color: colors.text }]}
                placeholder="New join password"
                placeholderTextColor={colors.textSecondary}
                value={superAdminNewPassword}
                onChangeText={(t) => {
                  setSuperAdminNewPassword(t);
                  setPasswordAdminError('');
                }}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
            </View>

            <View style={[styles.joinInput, { backgroundColor: colors.background, borderColor: colors.border, marginTop: 8 }]}>
              <TextInput
                style={[styles.joinInputText, { color: colors.text }]}
                placeholder="Confirm new join password"
                placeholderTextColor={colors.textSecondary}
                value={superAdminNewPasswordConfirm}
                onChangeText={(t) => {
                  setSuperAdminNewPasswordConfirm(t);
                  setPasswordAdminError('');
                }}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
            </View>

            {passwordAdminError ? (
              <Text style={[styles.farmIdErrorText, { color: colors.statusOverdue }]}>{passwordAdminError}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.superAdminButton, { backgroundColor: colors.statusOverdue + 'CC' }]}
              onPress={handleForceSetFarmPassword}
              disabled={forceSetFarmPasswordMutation.isPending}
            >
              {forceSetFarmPasswordMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Lock color="#fff" size={16} />
                  <Text style={styles.superAdminButtonText}>Force Change Password</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.superAdminButton, { backgroundColor: colors.primary, marginTop: 8 }]}
              onPress={() => { void passwordProtectedFarmsQuery.refetch(); }}
              disabled={passwordProtectedFarmsQuery.isFetching}
            >
              {passwordProtectedFarmsQuery.isFetching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <RefreshCw color="#fff" size={16} />
                  <Text style={styles.superAdminButtonText}>Refresh Password-Protected Farms</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={{ marginTop: 10, gap: 6 }}>
              {(passwordProtectedFarmsQuery.data?.farms ?? []).slice(0, 40).map((farm) => (
                <TouchableOpacity
                  key={farm.farmId}
                  style={[styles.memberRow, { backgroundColor: colors.background }]}
                  onPress={() => handleSelectPasswordFarm(farm.farmId)}
                >
                  <View style={styles.memberInfo}>
                    <View style={[styles.memberAvatar, { backgroundColor: colors.statusOverdue + '20' }]}>
                      <Lock color={colors.statusOverdue} size={14} />
                    </View>
                    <View style={styles.memberDetails}>
                      <Text style={[styles.memberDeviceId, { color: colors.text }]} numberOfLines={1}>
                        {farm.farmId}
                      </Text>
                      <Text style={[styles.memberJoinDate, { color: colors.textSecondary }]}>
                        Updated: {farm.updatedAt ? new Date(farm.updatedAt).toLocaleDateString() : 'Unknown'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
              {(passwordProtectedFarmsQuery.data?.farms?.length ?? 0) > 40 ? (
                <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                  Showing first 40 farms. Refine by typing a Farm ID above.
                </Text>
              ) : null}
            </View>
          </View>
          )}

          {superAdminTab === 'recovery' && (
          <>
          <View style={[styles.superAdminCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.superAdminLabel, { color: colors.textSecondary }]}>Forgot Password Testing</Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary, marginBottom: 8 }]}>
              Generate a password reset code for a farm to test the recovery flow.
            </Text>
            <View style={[styles.joinInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput
                style={[styles.joinInputText, { color: colors.text }]}
                placeholder="Farm ID for test reset"
                placeholderTextColor={colors.textSecondary}
                value={superAdminResetFarmId}
                onChangeText={(t) => {
                  setSuperAdminResetFarmId(t);
                  setSuperAdminResetError('');
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {superAdminResetError ? (
              <Text style={[styles.farmIdErrorText, { color: colors.statusOverdue }]}>{superAdminResetError}</Text>
            ) : null}
            <TouchableOpacity
              style={[styles.superAdminButton, { backgroundColor: colors.primary }]}
              onPress={handleGenerateTestResetCode}
              disabled={superAdminGenerateResetCodeMutation.isPending}
            >
              {superAdminGenerateResetCodeMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.superAdminButtonText}>Generate Test Reset Code</Text>
              )}
            </TouchableOpacity>
            {superAdminResetCode ? (
              <View style={{ marginTop: 8 }}>
                <Text style={[styles.debugText, { color: colors.text }]}>Code: {superAdminResetCode}</Text>
                <Text style={[styles.debugText, { color: colors.textSecondary }]}>
                  Expires: {superAdminResetExpiresAt ? new Date(superAdminResetExpiresAt).toLocaleString() : 'Unknown'}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.superAdminCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <Text style={[styles.superAdminLabel, { color: colors.textSecondary, marginBottom: 0 }]}>Password reset audit</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.superAdminButton, { backgroundColor: colors.accent, paddingVertical: 8, paddingHorizontal: 12 }]}
                  onPress={() => {
                    void Clipboard.setStringAsync(JSON.stringify(filteredAuditEvents, null, 2));
                    Alert.alert(
                      'Copied',
                      `${filteredAuditEvents.length} event${filteredAuditEvents.length !== 1 ? 's' : ''} exported (current list${auditFarmFilter.trim() ? ', filter applied' : ''}).`
                    );
                  }}
                  disabled={(passwordResetAuditQuery.data?.events?.length ?? 0) === 0}
                >
                  <Download color="#fff" size={14} />
                  <Text style={[styles.superAdminButtonText, { fontSize: 12 }]}>Export</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.superAdminButton, { backgroundColor: colors.primary, paddingVertical: 8, paddingHorizontal: 12 }]}
                  onPress={() => { void passwordResetAuditQuery.refetch(); }}
                  disabled={passwordResetAuditQuery.isFetching}
                >
                  {passwordResetAuditQuery.isFetching ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={[styles.superAdminButtonText, { fontSize: 12 }]}>Refresh</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
              Latest 50 events from the server (newest first). Filter by farm ID; Export copies the visible list. Tap copy on a row for one event.
            </Text>
            <View style={[styles.joinInput, { backgroundColor: colors.background, borderColor: colors.border, marginTop: 4 }]}>
              <TextInput
                style={[styles.joinInputText, { color: colors.text }]}
                placeholder="Filter by farm ID (optional)"
                placeholderTextColor={colors.textSecondary}
                value={auditFarmFilter}
                onChangeText={setAuditFarmFilter}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {(passwordResetAuditQuery.data?.events?.length ?? 0) > 0 && auditFarmFilter.trim() ? (
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Showing {filteredAuditEvents.length} of {passwordResetAuditQuery.data?.events?.length ?? 0} loaded events
              </Text>
            ) : null}
            {passwordResetAuditQuery.isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
            ) : (passwordResetAuditQuery.data?.events?.length ?? 0) === 0 ? (
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>No audit events yet.</Text>
            ) : filteredAuditEvents.length === 0 ? (
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                No events match this farm ID filter.
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                {filteredAuditEvents.map((ev) => (
                  <View
                    key={ev.id}
                    style={[styles.memberRow, { backgroundColor: colors.background, alignItems: 'flex-start' }]}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' as const }}>
                        {ev.type.replace(/_/g, ' ')}
                      </Text>
                      <Text style={[styles.debugText, { color: colors.textSecondary, marginTop: 4 }]}>
                        {ev.farmId} · {new Date(ev.at).toLocaleString()}
                      </Text>
                      {ev.clientId ? (
                        <Text style={[styles.debugText, { color: colors.textSecondary, marginTop: 2 }]} numberOfLines={1}>
                          Client: {ev.clientId}
                        </Text>
                      ) : null}
                      {ev.metadata && Object.keys(ev.metadata).length > 0 ? (
                        <Text style={[styles.debugText, { color: colors.textSecondary, marginTop: 4 }]} numberOfLines={2}>
                          {JSON.stringify(ev.metadata)}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={[styles.copyButton, { backgroundColor: colors.accent + '20', marginTop: 2 }]}
                      onPress={() => {
                        void Clipboard.setStringAsync(JSON.stringify(ev, null, 2));
                        Alert.alert('Copied', 'Audit event copied.');
                      }}
                    >
                      <Copy color={colors.accent} size={14} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
          </>
          )}

          {superAdminTab === 'announce' && (
          <View style={[styles.superAdminCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Megaphone color={colors.primary} size={20} />
              <Text style={[styles.superAdminLabel, { color: colors.text, marginBottom: 0 }]}>
                Global announcement
              </Text>
            </View>
            <Text style={[styles.settingDescription, { color: colors.textSecondary, marginBottom: 10 }]}>
              Short message shown to all users at the top of the app until the end time. Stored on the API server
              (Rork DB), not per farm.
            </Text>
            {globalAnnouncementPreviewQuery.data?.active && globalAnnouncementPreviewQuery.data.message ? (
              <View
                style={{
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: colors.primary + '18',
                  marginBottom: 12,
                }}
              >
                <Text style={[styles.settingDescription, { color: colors.text, fontWeight: '600' }]}>
                  Currently live
                </Text>
                <Text style={{ color: colors.text, marginTop: 4, fontSize: 14 }}>
                  {globalAnnouncementPreviewQuery.data.message}
                </Text>
                {globalAnnouncementPreviewQuery.data.endsAt ? (
                  <Text style={[styles.settingDescription, { color: colors.textSecondary, marginTop: 6 }]}>
                    Until {new Date(globalAnnouncementPreviewQuery.data.endsAt).toLocaleString()}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={[styles.settingDescription, { color: colors.textSecondary, marginBottom: 12 }]}>
                No active announcement.
              </Text>
            )}
            <Text style={[styles.superAdminLabel, { color: colors.textSecondary }]}>Message (max 800 characters)</Text>
            <TextInput
              style={[
                styles.joinInputText,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 8,
                  color: colors.text,
                  minHeight: 100,
                  marginTop: 6,
                  marginBottom: 12,
                  padding: 12,
                  textAlignVertical: 'top',
                },
              ]}
              placeholder="e.g. Planned maintenance Sunday 6–8 AM ET — sync may be delayed."
              placeholderTextColor={colors.textSecondary}
              value={announceBody}
              onChangeText={setAnnounceBody}
              multiline
              maxLength={800}
            />
            <Text style={[styles.superAdminLabel, { color: colors.textSecondary }]}>Show for</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 12 }}>
              {[
                { h: 6, label: '6 h' },
                { h: 24, label: '24 h' },
                { h: 72, label: '3 d' },
                { h: 168, label: '7 d' },
              ].map(({ h, label }) => (
                <TouchableOpacity
                  key={h}
                  onPress={() => setAnnounceDurationHours(h)}
                  style={[
                    styles.superAdminTabPill,
                    {
                      backgroundColor: announceDurationHours === h ? colors.primary : colors.background,
                      borderColor: announceDurationHours === h ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.superAdminTabText,
                      { color: announceDurationHours === h ? '#fff' : colors.text },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[
                styles.superAdminButton,
                { backgroundColor: colors.primary, marginBottom: 8 },
              ]}
              disabled={superAdminSetAnnouncementMutation.isPending || !announceBody.trim()}
              onPress={() => {
                superAdminSetAnnouncementMutation.mutate({
                  superAdminPin: enteredSuperAdminPin,
                  message: announceBody.trim(),
                  durationHours: announceDurationHours,
                });
              }}
            >
              {superAdminSetAnnouncementMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.superAdminButtonText}>Publish announcement</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.superAdminButton, { backgroundColor: colors.statusOverdue + 'DD' }]}
              disabled={superAdminClearAnnouncementMutation.isPending}
              onPress={() => {
                Alert.alert(
                  'Clear announcement?',
                  'Users will stop seeing the banner on their next refresh.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Clear',
                      style: 'destructive',
                      onPress: () =>
                        superAdminClearAnnouncementMutation.mutate({
                          superAdminPin: enteredSuperAdminPin,
                        }),
                    },
                  ]
                );
              }}
            >
              {superAdminClearAnnouncementMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.superAdminButtonText}>Clear announcement</Text>
              )}
            </TouchableOpacity>
          </View>
          )}

          {superAdminTab === 'debug' && (
          <>
          <View style={[styles.superAdminCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.superAdminLabel, { color: colors.textSecondary }]}>Legacy Pro (farm flag)</Text>
            <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
              Grants full Pro for every device on a farm without a RevenueCat subscription. Use for early adopters when device grandfathering does not apply.
            </Text>
            <View style={[styles.joinInput, { backgroundColor: colors.background, borderColor: colors.border, marginTop: 8 }]}>
              <TextInput
                style={[styles.joinInputText, { color: colors.text }]}
                placeholder="Farm ID"
                placeholderTextColor={colors.textSecondary}
                value={legacyProFarmId}
                onChangeText={setLegacyProFarmId}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {legacyProFarmId.trim().length > 0 && legacyProLookupQuery.data ? (
              <Text style={[styles.debugText, { color: colors.text, marginTop: 8 }]}>
                Status: {legacyProLookupQuery.data.legacyPro ? 'Legacy Pro ON' : 'Legacy Pro OFF'}
                {legacyProLookupQuery.data.trialActive
                  ? ` · Trial ${legacyProLookupQuery.data.trialDaysRemaining}d`
                  : ''}
              </Text>
            ) : null}
            <TouchableOpacity
              style={[styles.superAdminButton, { backgroundColor: colors.primary, marginTop: 8 }]}
              onPress={() => {
                const targetId = legacyProFarmId.trim();
                if (!targetId) {
                  Alert.alert('Farm ID required', 'Enter a farm ID first.');
                  return;
                }
                superAdminSetLegacyProMutation.mutate({
                  superAdminPin: enteredSuperAdminPin,
                  farmId: targetId,
                  legacyPro: true,
                });
              }}
              disabled={superAdminSetLegacyProMutation.isPending}
            >
              <Text style={styles.superAdminButtonText}>Grant legacy Pro</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.superAdminButton, { backgroundColor: colors.statusOverdue + 'CC', marginTop: 8 }]}
              onPress={() => {
                const targetId = legacyProFarmId.trim();
                if (!targetId) {
                  Alert.alert('Farm ID required', 'Enter a farm ID first.');
                  return;
                }
                superAdminSetLegacyProMutation.mutate({
                  superAdminPin: enteredSuperAdminPin,
                  farmId: targetId,
                  legacyPro: false,
                });
              }}
              disabled={superAdminSetLegacyProMutation.isPending}
            >
              <Text style={styles.superAdminButtonText}>Remove legacy Pro</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.superAdminCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.superAdminLabel, { color: colors.textSecondary }]}>Debug Info</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Farm ID: {farmId}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Device ID: {deviceId}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Display Name: {displayName || '(none)'}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Member Count: {memberCount}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Last Sync: {lastSyncTime ? new Date(lastSyncTime).toLocaleString() : 'Never'}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Equipment: {equipment.length}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Logs: {maintenanceLogs.length}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Consumables: {consumables.length}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Intervals: {intervals.length}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Service Routines: {serviceRoutines.length}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Inspection Routines: {inspectionRoutines.length}</Text>
            <Text style={[styles.superAdminLabel, { color: colors.textSecondary, marginTop: 12 }]}>Subscription & access</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>RC App User ID: {rcUserId || '(none)'}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Gate subscribed: {isSubscribed ? 'yes' : 'no'}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>RC grandfathered: {isGrandfathered ? 'yes' : 'no'}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Farm legacy Pro: {isFarmLegacyPro ? 'yes' : 'no'}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Trial: {isTrial ? `yes (${trialDaysRemaining}d)` : 'no'}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>
              RC original version: {(customerInfo as { originalAppVersion?: string } | null)?.originalAppVersion ?? '(none)'}
            </Text>
            <Text style={[styles.debugText, { color: colors.text }]}>
              RC original date: {(customerInfo as { originalPurchaseDate?: string } | null)?.originalPurchaseDate ?? '(none)'}
            </Text>
            <TouchableOpacity
              style={[styles.superAdminButton, { backgroundColor: colors.accent, marginTop: 8 }]}
              onPress={copySupportDebugInfo}
            >
              <Copy color="#fff" size={16} />
              <Text style={styles.superAdminButtonText}>Copy Debug Info</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.superAdminButton, { backgroundColor: colors.primary, marginTop: 8 }]}
              onPress={() => setShowPaywall(true)}
            >
              <Shield color="#fff" size={16} />
              <Text style={styles.superAdminButtonText}>Show Paywall</Text>
            </TouchableOpacity>
          </View>
          </>
          )}

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
