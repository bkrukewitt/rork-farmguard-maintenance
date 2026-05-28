import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Platform,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  RefreshControl,
  Keyboard,
  Pressable,
  Linking,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { 
  Tractor, 
  Bell, 
  Database,
  Trash2,
  FileText,
  ChevronRight,
  Shield,
  ClipboardList,
  Search,
  Download,
  Upload,
  Palette,
  Check,
  X,
  Cloud,
  RefreshCw,
  Users,
  Copy,
  Pencil,
  Lock,
  ServerCrash,
  Zap,
  AlertTriangle,
  MessageSquare,
  Megaphone,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { useFocusEffect } from '@react-navigation/native';
import { useFarmData, DuplicateItem, FarmMember, verifyFarmPasswordForId, checkFarmHasPassword } from '@/contexts/FarmDataContext';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { trpc } from '@/lib/trpc';
import { Equipment, Consumable, ServiceRoutine, InspectionRoutine, BUILT_IN_FUEL_TYPES, FuelLog } from '@/types/equipment';
import { Fuel } from 'lucide-react-native';
import { User } from 'lucide-react-native';
import ExportRecordsModal from '@/components/ExportRecordsModal';
import PaywallModal from '@/components/PaywallModal';
import { useSubscription } from '@/hooks/useSubscription';
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL, SUPPORT_FEEDBACK_FORM_URL } from '@/constants/legalUrls';

export default function SettingsScreen() {
  const router = useRouter();
  const { 
    equipment, 
    maintenanceLogs, 
    intervals, 
    consumables, 
    serviceRoutines, 
    inspectionRoutines, 
    getLowStockConsumables,
    farmId,
    farmName,
    deviceId,
    setFarmId: _setFarmId,
    isSyncing,
    lastSyncTime,
    syncToServer,
    memberCount,
    isAdmin,
    farmMembers,
    removeMember,
    leaveFarm,
    isLeavingFarm,
    updateFarmId,
    isUpdatingFarmId,
    displayName,
    updateDisplayName,
    updateFarmName,
    isUpdatingDisplayName,
    checkForDuplicatesOnJoin,
    applyDuplicateResolutions,
    deleteFarmFromServer,
    isDeletingFarm,
    forceDeleteEquipment,
    forceDeleteConsumables: _forceDeleteConsumables,
    purgeAndResync,
    isPurging,
    refreshData,
    joinPassword,
    setFarmPassword,
    isSettingFarmPassword,
    createFarm,
    isCreatingFarm,
    employees,
    updateEmployee,
    fuelLogs,
    customFuelTypes,
    addCustomFuelType,
    deleteCustomFuelType,
  } = useFarmData();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
    }
  }, [refreshData]);
  const { colors, colorSchemes, currentSchemeId, setColorScheme, currentScheme } = useTheme();
  const queryClient = useQueryClient();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showJoinFarmModal, setShowJoinFarmModal] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [joinFarmId, setJoinFarmId] = useState('');
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateItem[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [pendingJoinFarmId, setPendingJoinFarmId] = useState('');
  const [showEditFarmIdModal, setShowEditFarmIdModal] = useState(false);
  const [newFarmId, setNewFarmId] = useState('');
  const [farmIdError, setFarmIdError] = useState('');
  const [editFarmName, setEditFarmName] = useState('');
  const [showDisplayNameModal, setShowDisplayNameModal] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [showSuperAdminPinModal, setShowSuperAdminPinModal] = useState(false);
  const [superAdminPin, setSuperAdminPin] = useState('');
  const [superAdminPinError, setSuperAdminPinError] = useState('');
  const [deleteFarmIdInput, setDeleteFarmIdInput] = useState('');
  const footerTapCountRef = useRef(0);
  const footerTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showCreateFarmModal, setShowCreateFarmModal] = useState(false);
  const [newFarmIdToCreate, setNewFarmIdToCreate] = useState<string>('');
  const [newFarmNameToCreate, setNewFarmNameToCreate] = useState<string>('');
  const [createFarmError, setCreateFarmError] = useState<string>('');
  const [adminFarmIdLookup, setAdminFarmIdLookup] = useState<string>('');
  const [adminFarmMembers, setAdminFarmMembers] = useState<FarmMember[]>([]);
  const [isFetchingAdminMembers, setIsFetchingAdminMembers] = useState<boolean>(false);
  const [adminMembersError, setAdminMembersError] = useState<string>('');
  const [isUpdatingAdminMember, setIsUpdatingAdminMember] = useState<string | null>(null);
  const [superAdminFarmIdForPassword, setSuperAdminFarmIdForPassword] = useState<string>('');
  const [superAdminNewPassword, setSuperAdminNewPassword] = useState<string>('');
  const [superAdminNewPasswordConfirm, setSuperAdminNewPasswordConfirm] = useState<string>('');
  const [passwordAdminError, setPasswordAdminError] = useState<string>('');
  const [joinStep, setJoinStep] = useState<'farm_id' | 'password'>('farm_id');
  const [joinPasswordInput, setJoinPasswordInput] = useState('');
  const [joinPasswordError, setJoinPasswordError] = useState('');
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotResetCode, setForgotResetCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [superAdminResetFarmId, setSuperAdminResetFarmId] = useState('');
  const [superAdminResetCode, setSuperAdminResetCode] = useState('');
  const [superAdminResetExpiresAt, setSuperAdminResetExpiresAt] = useState('');
  const [superAdminResetError, setSuperAdminResetError] = useState('');
  type SuperAdminTab = 'danger' | 'members' | 'password' | 'recovery' | 'announce' | 'debug';
  const [superAdminTab, setSuperAdminTab] = useState<SuperAdminTab>('danger');
  const [auditFarmFilter, setAuditFarmFilter] = useState('');
  const [announceBody, setAnnounceBody] = useState('');
  const [announceDurationHours, setAnnounceDurationHours] = useState(48);

  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [showLeaveFarmModal, setShowLeaveFarmModal] = useState(false);
  const [selectedAdminTransfer, setSelectedAdminTransfer] = useState<string | null>(null);
  const [newJoinPassword, setNewJoinPassword] = useState('');
  const [newJoinPasswordConfirm, setNewJoinPasswordConfirm] = useState('');
  const [joinPasswordSetError, setJoinPasswordSetError] = useState('');
  const [showLinkEmployeeModal, setShowLinkEmployeeModal] = useState(false);
  const [linkingMemberDeviceId, setLinkingMemberDeviceId] = useState<string>('');
  const [isExportingFuel, setIsExportingFuel] = useState(false);
  const [showFuelExportModal, setShowFuelExportModal] = useState(false);
  const [fuelExportEquipmentId, setFuelExportEquipmentId] = useState<string>('all');
  const [fuelExportRange, setFuelExportRange] = useState<'ytd' | 'lifetime' | 'custom'>('ytd');
  const [fuelExportStartDate, setFuelExportStartDate] = useState('');
  const [fuelExportEndDate, setFuelExportEndDate] = useState('');
  const [showManageFuelTypesModal, setShowManageFuelTypesModal] = useState(false);
  const [newCustomFuelName, setNewCustomFuelName] = useState('');
  const {
    isProUser,
    grandfathered,
    isRestoring: isRestoringSubscription,
    restore,
    refresh: refreshSubscription,
  } = useSubscription();

  const SUPER_ADMIN_PIN = '9173';
  const DEBUG_PIN = '1847';
  const effectiveSuperAdminPin = process.env.EXPO_PUBLIC_SUPER_ADMIN_PIN || SUPER_ADMIN_PIN;

  const passwordProtectedFarmsQuery = trpc.farm.listPasswordProtectedFarms.useQuery(
    { superAdminPin: effectiveSuperAdminPin },
    { enabled: isSuperAdmin }
  );

  const passwordResetAuditQuery = trpc.farm.listPasswordResetAuditEvents.useQuery(
    { superAdminPin: effectiveSuperAdminPin, limit: 50 },
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

  const requestFarmPasswordResetMutation = trpc.farm.requestFarmPasswordReset.useMutation();
  const completeFarmPasswordResetMutation = trpc.farm.completeFarmPasswordReset.useMutation();
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

  const handleFooterTap = useCallback(() => {
    footerTapCountRef.current += 1;
    if (footerTapTimerRef.current) clearTimeout(footerTapTimerRef.current);
    if (footerTapCountRef.current >= 5) {
      footerTapCountRef.current = 0;
      if (isSuperAdmin || isDebugMode) {
        setIsSuperAdmin(false);
        setIsDebugMode(false);
      } else {
        setSuperAdminPin('');
        setSuperAdminPinError('');
        setShowSuperAdminPinModal(true);
      }
    } else {
      footerTapTimerRef.current = setTimeout(() => {
        footerTapCountRef.current = 0;
      }, 2000);
    }
  }, [isSuperAdmin, isDebugMode]);

  const handleSuperAdminLogin = useCallback(() => {
    if (superAdminPin === SUPER_ADMIN_PIN) {
      setIsSuperAdmin(true);
      setIsDebugMode(false);
      setShowSuperAdminPinModal(false);
      setSuperAdminPin('');
      setSuperAdminPinError('');
    } else if (superAdminPin === DEBUG_PIN) {
      setIsDebugMode(true);
      setIsSuperAdmin(false);
      setShowSuperAdminPinModal(false);
      setSuperAdminPin('');
      setSuperAdminPinError('');
    } else {
      setSuperAdminPinError('Incorrect PIN');
    }
  }, [superAdminPin]);

  useFocusEffect(
    useCallback(() => {
      void refreshSubscription();
    }, [refreshSubscription]),
  );

  const handleRestoreSubscription = useCallback(async () => {
    try {
      await restore();
      await refreshSubscription();
      Alert.alert('Purchases Restored', 'Your subscription status has been refreshed.');
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Could not restore purchases. Please try again.';
      Alert.alert('Restore Failed', message);
    }
  }, [restore, refreshSubscription]);

  const handleCreateFarm = async () => {
    const trimmed = newFarmIdToCreate.trim();
    if (!trimmed) {
      setCreateFarmError('Please enter a Farm ID.');
      return;
    }
    if (/\s/.test(trimmed)) {
      setCreateFarmError('Farm ID cannot contain spaces.');
      return;
    }
    try {
      await createFarm({ customId: trimmed, farmName: newFarmNameToCreate.trim() || undefined });
      setShowCreateFarmModal(false);
      setNewFarmIdToCreate('');
      setNewFarmNameToCreate('');
      setCreateFarmError('');
      Alert.alert('Farm Created', `Farm ID "${trimmed}" is ready. Share it with your team to sync data across devices.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create farm.';
      setCreateFarmError(msg);
    }
  };

  const handleGenerateAndCreateFarm = async () => {
    try {
      const result = await createFarm({ customId: undefined, farmName: newFarmNameToCreate.trim() || undefined });
      setShowCreateFarmModal(false);
      setNewFarmIdToCreate('');
      setNewFarmNameToCreate('');
      Alert.alert('Farm Created', `Your Farm ID is ready. Share it with your team to sync across devices.`);
      console.log('[Settings] Farm created:', result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create farm.';
      Alert.alert('Error', msg);
    }
  };

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
      superAdminPin: effectiveSuperAdminPin,
      farmId: targetId,
      newPassword: pw,
    });
  }, [
    effectiveSuperAdminPin,
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
      superAdminPin: effectiveSuperAdminPin,
      farmId: targetId,
    });
  }, [effectiveSuperAdminPin, superAdminGenerateResetCodeMutation, superAdminResetFarmId]);

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

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your equipment and maintenance records. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                'farmguard_equipment',
                'farmguard_maintenance_logs',
                'farmguard_intervals',
                'farmguard_consumables',
                'farmguard_service_routines',
              ]);
              void queryClient.invalidateQueries();
              Alert.alert('Success', 'All data has been cleared.');
            } catch (error) {
              console.log('Error clearing data:', error);
              Alert.alert('Error', 'Failed to clear data. Please try again.');
            }
          },
        },
      ]
    );
  };

  const [showExportModal, setShowExportModal] = useState(false);

  const handleBackupData = async () => {
    try {
      setIsBackingUp(true);

      const backupData = {
        version: '1.0',
        createdAt: new Date().toISOString(),
        data: {
          equipment,
          maintenanceLogs,
          intervals,
          consumables,
          serviceRoutines,
          inspectionRoutines,
        },
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      const fileName = `FarmGuard_Backup_${new Date().toISOString().split('T')[0]}.json`;

      if (Platform.OS === 'web') {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        Alert.alert('Success', 'Backup file downloaded successfully.');
      } else {
        const fileUri = FileSystem.cacheDirectory + fileName;
        await FileSystem.writeAsStringAsync(fileUri, jsonString, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: 'Save FarmGuard Backup',
            UTI: 'public.json',
          });
        } else {
          Alert.alert('Success', `Backup saved to ${fileUri}`);
        }
      }
    } catch (error) {
      console.error('Error backing up data:', error);
      Alert.alert('Error', 'Failed to create backup. Please try again.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreData = async () => {
    Alert.alert(
      'Restore Data',
      'This will replace all your current data with the backup. This action cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async () => {
            try {
              setIsRestoring(true);

              const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true,
              });

              if (result.canceled) {
                setIsRestoring(false);
                return;
              }

              const file = result.assets[0];
              let fileContent: string;

              if (Platform.OS === 'web') {
                const response = await fetch(file.uri);
                fileContent = await response.text();
              } else {
                fileContent = await FileSystem.readAsStringAsync(file.uri, {
                  encoding: FileSystem.EncodingType.UTF8,
                });
              }

              const backupData = JSON.parse(fileContent);

              if (!backupData.version || !backupData.data) {
                throw new Error('Invalid backup file format');
              }

              const { data } = backupData;

              await AsyncStorage.setItem('farmguard_equipment', JSON.stringify(data.equipment || []));
              await AsyncStorage.setItem('farmguard_maintenance_logs', JSON.stringify(data.maintenanceLogs || []));
              await AsyncStorage.setItem('farmguard_intervals', JSON.stringify(data.intervals || []));
              await AsyncStorage.setItem('farmguard_consumables', JSON.stringify(data.consumables || []));
              await AsyncStorage.setItem('farmguard_service_routines', JSON.stringify(data.serviceRoutines || []));
              await AsyncStorage.setItem('farmguard_inspection_routines', JSON.stringify(data.inspectionRoutines || []));

              void queryClient.invalidateQueries();

              Alert.alert(
                'Success',
                `Data restored successfully!\n\n• ${data.equipment?.length || 0} Equipment\n• ${data.maintenanceLogs?.length || 0} Maintenance Logs\n• ${data.consumables?.length || 0} Parts\n• ${data.serviceRoutines?.length || 0} Service Routines\n• ${data.inspectionRoutines?.length || 0} Inspection Routines`
              );
            } catch (error) {
              console.error('Error restoring data:', error);
              Alert.alert('Error', 'Failed to restore data. Please ensure the file is a valid FarmGuard backup.');
            } finally {
              setIsRestoring(false);
            }
          },
        },
      ]
    );
  };

  const validateFarmId = (value: string): string => {
    if (!value.trim()) return 'Farm ID cannot be empty.';
    if (/\s/.test(value)) return 'Farm ID cannot contain spaces.';
    if (value.trim() === farmId) return 'This is already your current Farm ID.';
    return '';
  };

  const handleEditFarmId = () => {
    setNewFarmId(farmId);
    setEditFarmName(farmName || '');
    setFarmIdError('');
    setShowEditFarmIdModal(true);
  };

  const handleNewFarmIdChange = (text: string) => {
    const noSpaces = text.replace(/\s/g, '');
    setNewFarmId(noSpaces);
    if (/\s/.test(text)) {
      setFarmIdError('Spaces are not allowed in Farm IDs.');
    } else {
      setFarmIdError('');
    }
  };

  const otherMembers = farmMembers.filter(m => m.device_id !== deviceId);
  const oldestOtherMember = otherMembers[0] ?? null;

  const confirmLeaveFarm = (transferToDeviceId?: string) => {
    Alert.alert(
      'Keep Local Data?',
      'Do you want to keep your equipment and maintenance data on this device, or clear it all?\n\nClearing data only removes it from this device. It does not delete your farm data from the cloud.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Keep Data',
          onPress: async () => {
            try {
              await leaveFarm({ transferToDeviceId, clearLocalData: false });
              setShowLeaveFarmModal(false);
              setShowEditFarmIdModal(false);
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to leave farm. Please try again.';
              Alert.alert('Error', message);
            }
          },
        },
        {
          text: 'Clear All Data',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveFarm({ transferToDeviceId, clearLocalData: true });
              setShowLeaveFarmModal(false);
              setShowEditFarmIdModal(false);
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to leave farm. Please try again.';
              Alert.alert('Error', message);
            }
          },
        },
      ]
    );
  };

  const handleLeaveFarmPress = () => {
    if (isAdmin && otherMembers.length > 0) {
      // Show admin transfer modal first, then data choice
      setSelectedAdminTransfer(oldestOtherMember?.device_id ?? null);
      setShowLeaveFarmModal(true);
    } else if (isAdmin && otherMembers.length === 0) {
      // Last member — confirm dissolve, then ask about data
      Alert.alert(
        'Leave & Dissolve Farm',
        'You are the only member. This will dissolve the farm organization.\n\nWould you like to keep your local data? Clearing data only removes it from this device. It does not delete your farm data from the cloud.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Keep Data',
            onPress: () => confirmLeaveFarm(),
          },
          {
            text: 'Leave & Clear All',
            style: 'destructive',
            onPress: async () => {
              try {
                await leaveFarm({ clearLocalData: true });
                setShowEditFarmIdModal(false);
              } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to leave farm. Please try again.';
                Alert.alert('Error', message);
              }
            },
          },
        ]
      );
    } else {
      // Regular member — ask about data first
      confirmLeaveFarm();
    }
  };

  const handleSaveFarmId = async () => {
    const trimmedId = newFarmId.trim();
    const idUnchanged = trimmedId === farmId;

    if (idUnchanged) {
      // Only updating farm name (Farm ID unchanged)
      try {
        await updateFarmName(editFarmName.trim() || null);
        setShowEditFarmIdModal(false);
        setNewFarmId('');
        setEditFarmName('');
        setFarmIdError('');
        Alert.alert('Success', 'Farm name has been updated.');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to update farm name. Please try again.';
        setFarmIdError(message);
      }
      return;
    }

    const error = validateFarmId(newFarmId);
    if (error) {
      setFarmIdError(error);
      return;
    }

    Alert.alert(
      'Change Farm ID',
      `Are you sure you want to change the Farm ID to "${trimmedId}"? All connected devices will need to use the new ID.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change',
          onPress: async () => {
            try {
              await updateFarmId(trimmedId);
              await updateFarmName(editFarmName.trim() || null);
              setShowEditFarmIdModal(false);
              setNewFarmId('');
              setEditFarmName('');
              setFarmIdError('');
              Alert.alert('Success', 'Farm ID has been updated. Share the new ID with your team members.');
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : 'Failed to update Farm ID. Please try again.';
              setFarmIdError(message);
            }
          },
        },
      ]
    );
  };

  const handleCopyFarmId = async () => {
    if (farmId) {
      await Clipboard.setStringAsync(farmId);
      Alert.alert('Copied!', 'Farm ID copied to clipboard. Share this with team members to sync data across devices.');
    }
  };

  const proceedWithJoin = useCallback(async (targetFarmId: string) => {
    setIsCheckingDuplicates(true);
    try {
      const result = await checkForDuplicatesOnJoin(targetFarmId);

      if (result.duplicates.length > 0) {
        setDuplicates(result.duplicates.map(d => ({ ...d, resolution: 'keep_both' as const })));
        setPendingJoinFarmId(targetFarmId);
        setShowJoinFarmModal(false);
        setJoinFarmId('');
        setJoinStep('farm_id');
        setJoinPasswordInput('');
        setShowDuplicateModal(true);
      } else if (result.hasLocalData && result.hasRemoteData) {
        Alert.alert(
          'Join Farm',
          'No duplicates found. Your local data will be merged with the farm data. Continue?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Join',
              onPress: async () => {
                await applyDuplicateResolutions(targetFarmId, []);
                setShowJoinFarmModal(false);
                setJoinFarmId('');
                setJoinStep('farm_id');
                setJoinPasswordInput('');
                Alert.alert('Success', 'You have joined the farm! Data has been merged.');
              },
            },
          ]
        );
      } else {
        await applyDuplicateResolutions(targetFarmId, []);
        setShowJoinFarmModal(false);
        setJoinFarmId('');
        setJoinStep('farm_id');
        setJoinPasswordInput('');
        Alert.alert('Success', 'You have joined the farm! Data will sync automatically.');
      }
    } catch (error) {
      console.error('Error checking duplicates:', error);
      Alert.alert('Error', 'Failed to check for duplicates. Please try again.');
    } finally {
      setIsCheckingDuplicates(false);
    }
  }, [checkForDuplicatesOnJoin, applyDuplicateResolutions]);

  const handleJoinFarm = async () => {
    if (!joinFarmId.trim()) {
      Alert.alert('Error', 'Please enter a Farm ID');
      return;
    }

    if (joinStep === 'farm_id') {
      setIsCheckingDuplicates(true);
      try {
        const hasPassword = await checkFarmHasPassword(joinFarmId.trim());
        if (hasPassword) {
          setJoinStep('password');
          setJoinPasswordInput('');
          setJoinPasswordError('');
        } else {
          await proceedWithJoin(joinFarmId.trim());
        }
      } catch (error) {
        console.error('Error checking farm password:', error);
        Alert.alert('Error', 'Could not reach that Farm ID. Please check it and try again.');
      } finally {
        setIsCheckingDuplicates(false);
      }
    } else {
      if (!joinPasswordInput.trim()) {
        setJoinPasswordError('Please enter the farm password.');
        return;
      }
      setIsCheckingDuplicates(true);
      try {
        const result = await verifyFarmPasswordForId(joinFarmId.trim(), joinPasswordInput.trim());
        if (!result.valid) {
          setJoinPasswordError('Incorrect password. Please try again.');
          return;
        }
        setJoinPasswordError('');
        await proceedWithJoin(joinFarmId.trim());
      } catch (error) {
        console.error('Error verifying farm password:', error);
        setJoinPasswordError('Failed to verify password. Please try again.');
      } finally {
        setIsCheckingDuplicates(false);
      }
    }
  };

  const handleRequestForgotPassword = async () => {
    const targetFarmId = joinFarmId.trim();
    if (!targetFarmId) {
      setForgotError('Enter the Farm ID first.');
      return;
    }
    setForgotError('');
    try {
      const result = await requestFarmPasswordResetMutation.mutateAsync({ farmId: targetFarmId });
      if (result.rateLimited) {
        Alert.alert('Too Many Requests', 'Please wait a few minutes before requesting another reset code.');
        return;
      }
      Alert.alert(
        'Reset Requested',
        'If this farm has a recovery email configured, a reset code has been sent.'
      );
    } catch (error) {
      setForgotError(error instanceof Error ? error.message : 'Failed to request password reset.');
    }
  };

  const handleCompleteForgotPassword = async () => {
    const targetFarmId = joinFarmId.trim();
    const code = forgotResetCode.trim();
    const newPw = forgotNewPassword.trim();
    const confirmPw = forgotConfirmPassword.trim();
    if (!targetFarmId) {
      setForgotError('Enter the Farm ID first.');
      return;
    }
    if (!code) {
      setForgotError('Enter the reset code from your email.');
      return;
    }
    if (!newPw || newPw.length < 4) {
      setForgotError('New password must be at least 4 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      setForgotError('Passwords do not match.');
      return;
    }

    setForgotError('');
    try {
      await completeFarmPasswordResetMutation.mutateAsync({
        farmId: targetFarmId,
        code,
        newPassword: newPw,
      });
      setShowForgotPasswordModal(false);
      setForgotResetCode('');
      setForgotNewPassword('');
      setForgotConfirmPassword('');
      Alert.alert('Password Reset', 'Password updated. You can now join with the new password.');
    } catch (error) {
      setForgotError(error instanceof Error ? error.message : 'Failed to reset password.');
    }
  };

  const handleSaveJoinPassword = async () => {
    const trimmed = newJoinPassword.trim();
    if (!trimmed) {
      setJoinPasswordSetError('Password cannot be empty.');
      return;
    }
    if (trimmed !== newJoinPasswordConfirm.trim()) {
      setJoinPasswordSetError('Passwords do not match.');
      return;
    }
    try {
      await setFarmPassword(trimmed);
      setShowSetPasswordModal(false);
      setNewJoinPassword('');
      setNewJoinPasswordConfirm('');
      setJoinPasswordSetError('');
      Alert.alert('Password Set', 'Anyone joining your farm will now need this password.');
    } catch (error) {
      console.error('Error setting join password:', error);
      const msg = error instanceof Error ? error.message : 'Failed to set password.';
      setJoinPasswordSetError(msg);
    }
  };

  const handleRemoveJoinPassword = () => {
    Alert.alert(
      'Remove Password',
      'Are you sure? Anyone with your Farm ID will be able to join without a password.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await setFarmPassword(null);
              setShowSetPasswordModal(false);
              Alert.alert('Password Removed', 'Your farm no longer requires a password to join.');
            } catch (error) {
              console.error('Error removing join password:', error);
              Alert.alert('Error', 'Failed to remove password. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleDuplicateResolution = (index: number, resolution: 'keep_local' | 'keep_remote' | 'keep_both') => {
    setDuplicates(prev => prev.map((d, i) => i === index ? { ...d, resolution } : d));
  };

  const handleApplyResolutions = async () => {
    try {
      await applyDuplicateResolutions(pendingJoinFarmId, duplicates);
      setShowDuplicateModal(false);
      setDuplicates([]);
      setPendingJoinFarmId('');
      Alert.alert('Success', 'You have joined the farm! Data has been merged based on your selections.');
    } catch (error) {
      console.error('Error applying resolutions:', error);
      Alert.alert('Error', 'Failed to merge data. Please try again.');
    }
  };

  const getDuplicateDisplayName = (item: DuplicateItem) => {
    switch (item.type) {
      case 'equipment':
        return (item.local as Equipment).name;
      case 'consumable':
        return (item.local as Consumable).name;
      case 'serviceRoutine':
        return (item.local as ServiceRoutine).name;
      case 'inspectionRoutine':
        return (item.local as InspectionRoutine).name;
      default:
        return 'Unknown';
    }
  };

  const getDuplicateTypeLabel = (type: DuplicateItem['type']) => {
    switch (type) {
      case 'equipment': return 'Equipment';
      case 'consumable': return 'Part';
      case 'serviceRoutine': return 'Service Routine';
      case 'inspectionRoutine': return 'Inspection Routine';
      default: return 'Item';
    }
  };

  const handleOpenFeedbackForm = useCallback(async () => {
    try {
      await Linking.openURL(SUPPORT_FEEDBACK_FORM_URL);
    } catch (error) {
      console.error('[Settings] Error opening feedback form:', error);
      Alert.alert('Error', 'Could not open the feedback form.');
    }
  }, []);

  const handleManualSync = async () => {
    try {
      await syncToServer();
      Alert.alert('Success', 'Data synced to cloud successfully!');
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Error', 'Failed to sync data. Please try again.');
    }
  };

  const handleSaveDisplayName = async () => {
    const trimmed = editDisplayName.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Please enter a name.');
      return;
    }
    try {
      await updateDisplayName(trimmed);
      setShowDisplayNameModal(false);
      Alert.alert('Success', 'Your display name has been updated.');
    } catch (error) {
      console.error('Error updating display name:', error);
      Alert.alert('Error', 'Failed to update display name. Please try again.');
    }
  };

  const handleRemoveMember = (targetDeviceId: string) => {
    Alert.alert(
      'Remove Device',
      'Are you sure you want to remove this device from the farm? They will need to rejoin.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMember(targetDeviceId);
              Alert.alert('Success', 'Device has been removed from the farm.');
            } catch (error) {
              console.error('Error removing member:', error);
              Alert.alert('Error', 'Failed to remove device. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleExportFuelData = async () => {
    try {
      setIsExportingFuel(true);
      let logsToExport = [...fuelLogs];

      if (fuelExportEquipmentId !== 'all') {
        logsToExport = logsToExport.filter(fl => fl.equipmentId === fuelExportEquipmentId);
      }

      const now = new Date();
      if (fuelExportRange === 'ytd') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        logsToExport = logsToExport.filter(fl => new Date(fl.date) >= startOfYear);
      } else if (fuelExportRange === 'custom') {
        if (fuelExportStartDate) {
          logsToExport = logsToExport.filter(fl => fl.date >= fuelExportStartDate);
        }
        if (fuelExportEndDate) {
          logsToExport = logsToExport.filter(fl => fl.date <= fuelExportEndDate);
        }
      }

      if (logsToExport.length === 0) {
        Alert.alert('No Data', 'No fuel logs match the selected filters.');
        setIsExportingFuel(false);
        return;
      }

      logsToExport.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const getFuelTypeName = (fl: FuelLog) => {
        if (fl.fuelType === 'custom' && fl.customFuelTypeName) return fl.customFuelTypeName;
        const built = BUILT_IN_FUEL_TYPES.find(bt => bt.value === fl.fuelType);
        return built?.label ?? fl.fuelType;
      };

      const worksheetData = [
        ['Date', 'Equipment', 'Fuel Type', 'Gallons', 'DEF Gallons', 'Hours/Miles', 'Filled By', 'Notes'],
        ...logsToExport.map(fl => [
          fl.date,
          equipment.find(e => e.id === fl.equipmentId)?.name ?? 'Unknown',
          getFuelTypeName(fl),
          fl.gallons,
          fl.defGallons ?? '',
          fl.hoursAtFillUp,
          fl.filledBy + (fl.filledByName ? ` - ${fl.filledByName}` : ''),
          fl.notes ?? '',
        ]),
      ];

      const totalGallons = logsToExport.reduce((s, fl) => s + fl.gallons, 0);
      const totalDef = logsToExport.reduce((s, fl) => s + (fl.defGallons ?? 0), 0);
      worksheetData.push([]);
      worksheetData.push(['Total Fuel (gal)', '', '', totalGallons, totalDef > 0 ? totalDef : '', '', '', '']);

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData as unknown[][]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Fuel Usage');

      const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
      const eqName = fuelExportEquipmentId === 'all' ? 'All_Equipment' : (equipment.find(e => e.id === fuelExportEquipmentId)?.name ?? 'Equipment').replace(/\s/g, '_');
      const fileName = `Fuel_Usage_${eqName}_${fuelExportRange}_${new Date().toISOString().split('T')[0]}.xlsx`;
      const fileUri = FileSystem.cacheDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (Platform.OS === 'web') {
        const blob = new Blob(
          [Uint8Array.from(atob(wbout), c => c.charCodeAt(0))],
          { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        Alert.alert('Success', `Exported ${logsToExport.length} fuel log${logsToExport.length !== 1 ? 's' : ''}.`);
      } else {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Export Fuel Data',
            UTI: 'com.microsoft.excel.xlsx',
          });
        } else {
          Alert.alert('Success', `Exported ${logsToExport.length} fuel log${logsToExport.length !== 1 ? 's' : ''}.`);
        }
      }

      setShowFuelExportModal(false);
    } catch (error) {
      console.error('Error exporting fuel data:', error);
      Alert.alert('Error', 'Failed to export fuel data. Please try again.');
    } finally {
      setIsExportingFuel(false);
    }
  };

  const handleAddCustomFuelType = async () => {
    const trimmed = newCustomFuelName.trim();
    if (!trimmed) return;
    try {
      await addCustomFuelType(trimmed);
      setNewCustomFuelName('');
    } catch (error) {
      console.error('Error adding custom fuel type:', error);
      Alert.alert('Error', 'Failed to add custom fuel type.');
    }
  };

  const handleDeleteCustomFuelType = (id: string, name: string) => {
    Alert.alert(
      'Delete Fuel Type',
      `Remove "${name}" from your custom fuel types?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCustomFuelType(id);
            } catch (error) {
              console.error('Error deleting custom fuel type:', error);
              Alert.alert('Error', 'Failed to delete fuel type.');
            }
          },
        },
      ]
    );
  };

  const handleExportLowStockParts = async () => {
    try {
      setIsExporting(true);
      const lowStockParts = getLowStockConsumables();

      if (lowStockParts.length === 0) {
        Alert.alert('No Low Stock Parts', 'You don\'t have any parts that are at or below their low stock threshold.');
        setIsExporting(false);
        return;
      }

      const worksheetData = [
        ['Part Name', 'Quantity'],
        ...lowStockParts.map(part => [
          part.name,
          part.lowStockThreshold + 1,
        ]),
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Low Stock Parts');

      const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
      const fileName = `Low_Stock_Parts_${new Date().toISOString().split('T')[0]}.xlsx`;
      const fileUri = FileSystem.cacheDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (Platform.OS === 'web') {
        const blob = new Blob(
          [Uint8Array.from(atob(wbout), c => c.charCodeAt(0))],
          { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        Alert.alert('Success', `Exported ${lowStockParts.length} low stock part${lowStockParts.length !== 1 ? 's' : ''}.`);
      } else {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Export Low Stock Parts',
            UTI: 'com.microsoft.excel.xlsx',
          });
        } else {
          Alert.alert('Success', `Exported ${lowStockParts.length} low stock part${lowStockParts.length !== 1 ? 's' : ''} to ${fileUri}`);
        }
      }
    } catch (error) {
      console.error('Error exporting low stock parts:', error);
      Alert.alert('Error', 'Failed to export low stock parts. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const planSummary = grandfathered ? 'Legacy Pro' : isProUser ? 'Pro' : 'Free';
  const syncSummary = farmId
    ? (lastSyncTime ? `Last sync ${new Date(lastSyncTime).toLocaleDateString()}` : 'Not synced yet')
    : 'Not configured';
  const farmSummary = farmName || farmId || 'No farm configured';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <View style={[styles.statsCard, { backgroundColor: colors.surface }]}>
        <View style={styles.statsHeader}>
          <Tractor color={colors.primary} size={24} />
          <Text style={[styles.statsTitle, { color: colors.text }]}>Your Farm Stats</Text>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{equipment.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Equipment</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.borderLight }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{maintenanceLogs.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Service Logs</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Quick Status</Text>
        <View style={styles.quickStatusGrid}>
          <View style={[styles.quickStatusCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.settingIcon, { backgroundColor: colors.primary + '15' }]}>
              <Zap color={colors.primary} size={18} />
            </View>
            <Text style={[styles.quickStatusLabel, { color: colors.textSecondary }]}>Plan</Text>
            <Text style={[styles.quickStatusValue, { color: colors.text }]} numberOfLines={1}>
              {planSummary}
            </Text>
          </View>
          <View style={[styles.quickStatusCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.settingIcon, { backgroundColor: colors.secondary + '15' }]}>
              <RefreshCw color={colors.secondary} size={18} />
            </View>
            <Text style={[styles.quickStatusLabel, { color: colors.textSecondary }]}>Sync</Text>
            <Text style={[styles.quickStatusValue, { color: colors.text }]} numberOfLines={1}>
              {syncSummary}
            </Text>
          </View>
          <View style={[styles.quickStatusCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accent + '15' }]}>
              <Cloud color={colors.accent} size={18} />
            </View>
            <Text style={[styles.quickStatusLabel, { color: colors.textSecondary }]}>Farm</Text>
            <Text style={[styles.quickStatusValue, { color: colors.text }]} numberOfLines={1}>
              {farmSummary}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Account & Farm</Text>
        
        <View style={[styles.syncCard, { backgroundColor: colors.surface }]}>
          <View style={styles.syncHeader}>
            <Cloud color={colors.primary} size={24} />
            <View style={styles.syncInfo}>
              <Text style={[styles.syncTitle, { color: colors.text }]}>Farm ID</Text>
              <Text style={[styles.syncId, { color: farmId ? colors.textSecondary : colors.statusDue }]} numberOfLines={1}>
                {farmId || 'Not configured'}
              </Text>
              {farmName ? (
                <Text style={[styles.syncId, { color: colors.textSecondary }]} numberOfLines={1}>
                  {farmName}
                </Text>
              ) : null}
            </View>
            <View style={styles.farmIdActions}>
              {isAdmin && (
                <TouchableOpacity 
                  style={[styles.copyButton, { backgroundColor: colors.accent + '15' }]}
                  onPress={handleEditFarmId}
                >
                  <Pencil color={colors.accent} size={18} />
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={[styles.copyButton, { backgroundColor: colors.primary + '15' }]}
                onPress={handleCopyFarmId}
              >
                <Copy color={colors.primary} size={18} />
              </TouchableOpacity>
            </View>
          </View>
          
          {memberCount > 0 && (
            <View style={[styles.memberCountBadge, { backgroundColor: colors.primary + '15' }]}>
              <Users color={colors.primary} size={16} />
              <Text style={[styles.memberCountText, { color: colors.primary }]}>
                {memberCount} {memberCount === 1 ? 'device' : 'devices'} connected
              </Text>
            </View>
          )}

          {isAdmin && (
            <View style={[styles.adminIndicator, { backgroundColor: colors.statusOk + '15' }]}>
              <Shield color={colors.statusOk} size={14} />
              <Text style={[styles.adminIndicatorText, { color: colors.statusOk }]}>You are the farm admin</Text>
            </View>
          )}

          {isAdmin && (
            <TouchableOpacity
              style={[styles.displayNameRow, { backgroundColor: colors.background }]}
              onPress={() => {
                setNewJoinPassword('');
                setNewJoinPasswordConfirm('');
                setJoinPasswordSetError('');
                setShowSetPasswordModal(true);
              }}
            >
              <View style={[styles.displayNameIcon, { backgroundColor: joinPassword ? colors.statusOverdue + '18' : colors.textSecondary + '15' }]}>
                <Lock color={joinPassword ? colors.statusOverdue : colors.textSecondary} size={18} />
              </View>
              <View style={styles.displayNameInfo}>
                <Text style={[styles.displayNameLabel, { color: colors.textSecondary }]}>Join Password</Text>
                <Text style={[styles.displayNameValue, { color: joinPassword ? colors.statusOverdue : colors.textSecondary }]}>
                  {joinPassword ? 'Password protected' : 'No password — anyone can join'}
                </Text>
              </View>
              <ChevronRight color={colors.textSecondary} size={16} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.displayNameRow, { backgroundColor: colors.background }]}
            onPress={() => {
              setEditDisplayName(displayName || '');
              setShowDisplayNameModal(true);
            }}
          >
            <View style={[styles.displayNameIcon, { backgroundColor: colors.secondary + '15' }]}>
              <User color={colors.secondary} size={18} />
            </View>
            <View style={styles.displayNameInfo}>
              <Text style={[styles.displayNameLabel, { color: colors.textSecondary }]}>Your Name</Text>
              <Text style={[styles.displayNameValue, { color: displayName ? colors.text : colors.textSecondary }]}>
                {displayName || 'Tap to set your name'}
              </Text>
            </View>
            <Pencil color={colors.textSecondary} size={16} />
          </TouchableOpacity>

          {farmMembers.length > 0 && (
            <View style={styles.membersList}>
              <Text style={[styles.membersListTitle, { color: colors.text }]}>Farm Members</Text>
              {farmMembers.map((member: FarmMember) => (
                <View key={member.device_id} style={[styles.memberRow, { backgroundColor: colors.background }]}>
                  <View style={styles.memberInfo}>
                    <View style={[styles.memberAvatar, { backgroundColor: member.device_id === deviceId ? colors.primary + '20' : colors.secondary + '20' }]}>
                      <Text style={[styles.memberAvatarText, { color: member.device_id === deviceId ? colors.primary : colors.secondary }]}>
                        {(member.display_name || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.memberDetails}>
                      <Text style={[styles.memberDeviceId, { color: colors.text }]} numberOfLines={1}>
                        {member.display_name || (member.device_id === deviceId ? 'You (no name set)' : `Device ${member.device_id.slice(0, 8)}`)}
                      </Text>
                      <View style={styles.memberBadges}>
                        {member.role === 'admin' && (
                          <View style={[styles.roleBadge, { backgroundColor: colors.primary + '20' }]}>
                            <Text style={[styles.roleBadgeText, { color: colors.primary }]}>Admin</Text>
                          </View>
                        )}
                        {member.device_id === deviceId && (
                          <View style={[styles.roleBadge, { backgroundColor: colors.statusOk + '20' }]}>
                            <Text style={[styles.roleBadgeText, { color: colors.statusOk }]}>You</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.memberJoinDate, { color: colors.textSecondary }]}>
                        Joined {new Date(member.joined_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {isAdmin && (
                      <TouchableOpacity
                        onPress={() => {
                          setLinkingMemberDeviceId(member.device_id);
                          setShowLinkEmployeeModal(true);
                        }}
                        style={[styles.removeMemberBtn, { backgroundColor: colors.primary + '15' }]}
                      >
                        <User color={colors.primary} size={16} />
                      </TouchableOpacity>
                    )}
                    {isAdmin && member.device_id !== deviceId && member.role !== 'admin' && (
                      <TouchableOpacity
                        onPress={() => handleRemoveMember(member.device_id)}
                        style={[styles.removeMemberBtn, { backgroundColor: colors.statusOverdue + '15' }]}
                      >
                        <X color={colors.statusOverdue} size={16} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
              {(() => {
                const linkedPairs = employees.filter(e => e.linkedDeviceId);
                if (linkedPairs.length === 0) return null;
                return (
                  <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.borderLight }}>
                    <Text style={[{ fontSize: 12, fontWeight: '500' as const, marginBottom: 4 }, { color: colors.textSecondary }]}>Linked Employees</Text>
                    {linkedPairs.map(emp => {
                      const linkedMember = farmMembers.find(m => m.device_id === emp.linkedDeviceId);
                      return (
                        <Text key={emp.id} style={[{ fontSize: 12, marginBottom: 2 }, { color: colors.text }]}>
                          {emp.name} → {linkedMember?.display_name || `Device ${emp.linkedDeviceId?.slice(0, 8)}`}
                        </Text>
                      );
                    })}
                  </View>
                );
              })()}
            </View>
          )}
          
          {lastSyncTime && (
            <Text style={[styles.lastSync, { color: colors.textSecondary }]}>
              Last synced: {new Date(lastSyncTime).toLocaleString()}
            </Text>
          )}
          
          {!farmId ? (
            <View>
              <TouchableOpacity
                style={{ paddingVertical: 8, alignItems: 'center', marginBottom: 8 }}
                onPress={() => { setNewFarmIdToCreate(''); setCreateFarmError(''); setShowCreateFarmModal(true); }}
              >
                <Text style={[{ fontSize: 13, textDecorationLine: 'underline' as const }, { color: colors.primary }]}>Set a custom Farm ID</Text>
              </TouchableOpacity>
              <View style={styles.syncActions}>
                <TouchableOpacity
                  style={[styles.syncButton, { backgroundColor: colors.primary }]}
                  onPress={handleGenerateAndCreateFarm}
                  disabled={isCreatingFarm}
                >
                  {isCreatingFarm ? (<ActivityIndicator size="small" color="#fff" />) : (<Cloud color="#fff" size={18} />)}
                  <Text style={styles.syncButtonText}>{isCreatingFarm ? 'Creating...' : 'Create Farm'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.syncButton, { backgroundColor: colors.secondary }]}
                  onPress={() => setShowJoinFarmModal(true)}
                  disabled={isCheckingDuplicates}
                >
                  {isCheckingDuplicates ? (<ActivityIndicator size="small" color="#fff" />) : (<Users color="#fff" size={18} />)}
                  <Text style={styles.syncButtonText}>{isCheckingDuplicates ? 'Checking...' : 'Join Farm'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.syncActions}>
              <TouchableOpacity
                style={[styles.syncButton, { backgroundColor: colors.primary }]}
                onPress={handleManualSync}
                disabled={isSyncing}
              >
                {isSyncing ? (<ActivityIndicator size="small" color="#fff" />) : (<RefreshCw color="#fff" size={18} />)}
                <Text style={styles.syncButtonText}>{isSyncing ? 'Syncing...' : 'Sync Now'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.syncButton, { backgroundColor: colors.secondary }]}
                onPress={() => setShowJoinFarmModal(true)}
                disabled={isCheckingDuplicates}
              >
                {isCheckingDuplicates ? (<ActivityIndicator size="small" color="#fff" />) : (<Users color="#fff" size={18} />)}
                <Text style={styles.syncButtonText}>{isCheckingDuplicates ? 'Checking...' : 'Join Farm'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Appearance</Text>
        
        <TouchableOpacity 
          style={[styles.settingRow, { backgroundColor: colors.surface }]} 
          onPress={() => setShowColorPicker(true)}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.primary + '15' }]}>
              <Palette color={colors.primary} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Color Scheme</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                {currentScheme.name}
              </Text>
            </View>
          </View>
          <View style={styles.colorPreview}>
            <View style={[styles.colorDot, { backgroundColor: colors.primary }]} />
            <View style={[styles.colorDot, { backgroundColor: colors.secondary }]} />
            <View style={[styles.colorDot, { backgroundColor: colors.accent }]} />
          </View>
          <ChevronRight color={colors.textSecondary} size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Maintenance Templates</Text>
        
        <TouchableOpacity 
          style={[styles.settingRow, { backgroundColor: colors.surface }]} 
          onPress={() => router.push('/routines' as any)}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.primary + '15' }]}>
              <ClipboardList color={colors.primary} size={20} />
            </View>
            <View>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Service Routines</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                {serviceRoutines.length} routine{serviceRoutines.length !== 1 ? 's' : ''} created
              </Text>
            </View>
          </View>
          <ChevronRight color={colors.textSecondary} size={20} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.settingRow, { backgroundColor: colors.surface }]} 
          onPress={() => router.push('/routines/inspection' as any)}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: '#8B5CF6' + '15' }]}>
              <Search color="#8B5CF6" size={20} />
            </View>
            <View>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Inspection Routines</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                {inspectionRoutines.length} routine{inspectionRoutines.length !== 1 ? 's' : ''} created
              </Text>
            </View>
          </View>
          <ChevronRight color={colors.textSecondary} size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Notifications</Text>
        <View style={[styles.settingRow, { backgroundColor: colors.surface }]}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accent + '15' }]}>
              <Bell color={colors.accent} size={20} />
            </View>
            <View>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Maintenance Reminders</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Get notified when service is due</Text>
            </View>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: colors.border, true: colors.primary + '60' }}
            thumbColor={notificationsEnabled ? colors.primary : colors.textSecondary}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Data & Reports</Text>
        
        <TouchableOpacity style={[styles.settingRow, { backgroundColor: colors.surface }]} onPress={() => setShowExportModal(true)}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.primary + '15' }]}>
              <FileText color={colors.primary} size={20} />
            </View>
            <View>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Export Records</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Maintenance & fuel reports as PDF or Excel</Text>
            </View>
          </View>
          <ChevronRight color={colors.textSecondary} size={20} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.settingRow, { backgroundColor: colors.surface }]} 
          onPress={handleExportLowStockParts}
          disabled={isExporting}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.accent + '15' }]}>
              <Download color={colors.accent} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Export Low Stock Parts</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Download parts inventory as Excel</Text>
            </View>
          </View>
          {isExporting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <ChevronRight color={colors.textSecondary} size={20} />
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.settingRow, { backgroundColor: colors.surface }]} 
          onPress={handleBackupData}
          disabled={isBackingUp}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.statusOk + '15' }]}>
              <Database color={colors.statusOk} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Backup Data</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Export all data as JSON file</Text>
            </View>
          </View>
          {isBackingUp ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <ChevronRight color={colors.textSecondary} size={20} />
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.settingRow, { backgroundColor: colors.surface }]} 
          onPress={handleRestoreData}
          disabled={isRestoring}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.secondary + '15' }]}>
              <Upload color={colors.secondary} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Restore Data</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Import from backup file</Text>
            </View>
          </View>
          {isRestoring ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <ChevronRight color={colors.textSecondary} size={20} />
          )}
        </TouchableOpacity>

      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Fuel Tracking</Text>

        <TouchableOpacity
          style={[styles.settingRow, { backgroundColor: colors.surface }]}
          onPress={() => {
            setFuelExportEquipmentId('all');
            setFuelExportRange('ytd');
            setFuelExportStartDate('');
            setFuelExportEndDate('');
            setShowFuelExportModal(true);
          }}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: '#059669' + '15' }]}>
              <Fuel color="#059669" size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Export Fuel Data</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                {fuelLogs.length} fuel log{fuelLogs.length !== 1 ? 's' : ''} recorded
              </Text>
            </View>
          </View>
          <ChevronRight color={colors.textSecondary} size={20} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingRow, { backgroundColor: colors.surface }]}
          onPress={() => {
            setNewCustomFuelName('');
            setShowManageFuelTypesModal(true);
          }}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.secondary + '15' }]}>
              <Fuel color={colors.secondary} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Manage Fuel Types</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                {BUILT_IN_FUEL_TYPES.length + customFuelTypes.length} fuel type{BUILT_IN_FUEL_TYPES.length + customFuelTypes.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
          <ChevronRight color={colors.textSecondary} size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Support</Text>
        
        <TouchableOpacity
          style={[styles.settingRow, { backgroundColor: colors.surface }]}
          onPress={handleOpenFeedbackForm}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: '#3B82F6' + '15' }]}>
              <MessageSquare color="#3B82F6" size={20} />
            </View>
            <View>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Send Feedback</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Opens our feedback form in your browser
              </Text>
            </View>
          </View>
          <ChevronRight color={colors.textSecondary} size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Subscription</Text>
        <View style={[styles.syncCard, { backgroundColor: colors.surface }]}>
          <View style={styles.subscriptionStatusRow}>
            <View style={[styles.settingIcon, { backgroundColor: colors.primary + '15' }]}>
              <Zap color={colors.primary} size={20} />
            </View>
            <Text style={[styles.subscriptionStatusLine, { color: colors.text }]}>
              {grandfathered
                ? 'Pro — Legacy access'
                : isProUser
                  ? 'Pro'
                  : 'Free plan'}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.syncButton,
              {
                backgroundColor: colors.primary,
                marginTop: 12,
                opacity: isRestoringSubscription ? 0.7 : 1,
              },
            ]}
            onPress={handleRestoreSubscription}
            disabled={isRestoringSubscription}
          >
            {isRestoringSubscription ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <RefreshCw color="#fff" size={18} />
            )}
            <Text style={styles.syncButtonText}>
              {isRestoringSubscription ? 'Restoring...' : 'Restore Purchases'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.syncButton,
              {
                backgroundColor: colors.surfaceAlt,
                marginTop: 10,
                borderWidth: 1,
                borderColor: colors.border,
              },
            ]}
            onPress={() => setShowPaywall(true)}
            activeOpacity={0.8}
          >
            <Shield color={colors.textSecondary} size={18} />
            <Text style={[styles.syncButtonText, { color: colors.text }]}>Change Plan</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>About</Text>

        <TouchableOpacity
          style={[styles.settingRow, { backgroundColor: colors.surface }]}
          onPress={() => {
            void WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.secondary + '15' }]}>
              <Shield color={colors.secondary} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Privacy Policy</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                View our privacy policy in your browser
              </Text>
            </View>
          </View>
          <ChevronRight color={colors.textSecondary} size={20} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingRow, { backgroundColor: colors.surface }]}
          onPress={() => {
            void WebBrowser.openBrowserAsync(TERMS_OF_USE_URL);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.primary + '15' }]}>
              <FileText color={colors.primary} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Terms of Use</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                View terms of use in your browser
              </Text>
            </View>
          </View>
          <ChevronRight color={colors.textSecondary} size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.statusOverdue }]}>Danger Zone</Text>
        <TouchableOpacity style={[styles.settingRow, { backgroundColor: colors.surface }]} onPress={handleClearData}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.statusOverdue + '15' }]}>
              <Trash2 color={colors.statusOverdue} size={20} />
            </View>
            <View>
              <Text style={[styles.settingLabel, { color: colors.statusOverdue }]}>Clear All Data</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                Delete all equipment and logs on this device
              </Text>
            </View>
          </View>
          <ChevronRight color={colors.textSecondary} size={20} />
        </TouchableOpacity>
      </View>

      {isDebugMode && !isSuperAdmin && (
        <View style={styles.section}>
          <View style={[styles.superAdminHeader, { backgroundColor: colors.accent + '15' }]}>
            <Database color={colors.accent} size={16} />
            <Text style={[styles.sectionTitle, { color: colors.accent, marginBottom: 0 }]}>Debug Info</Text>
          </View>

          <View style={[styles.superAdminCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.superAdminLabel, { color: colors.textSecondary }]}>Device & Farm</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Farm ID: {farmId}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Device ID: {deviceId}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Display Name: {displayName || '(none)'}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Member Count: {memberCount}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Last Sync: {lastSyncTime ? new Date(lastSyncTime).toLocaleString() : 'Never'}</Text>
          </View>

          <View style={[styles.superAdminCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.superAdminLabel, { color: colors.textSecondary }]}>Data Counts</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Equipment: {equipment.length}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Maintenance Logs: {maintenanceLogs.length}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Consumables: {consumables.length}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Intervals: {intervals.length}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Service Routines: {serviceRoutines.length}</Text>
            <Text style={[styles.debugText, { color: colors.text }]}>Inspection Routines: {inspectionRoutines.length}</Text>
          </View>

          <TouchableOpacity
            style={[styles.superAdminButton, { backgroundColor: colors.accent, marginHorizontal: 16, marginBottom: 8 }]}
            onPress={() => {
              const info = [
                `Farm ID: ${farmId}`,
                `Device ID: ${deviceId}`,
                `Display Name: ${displayName || '(none)'}`,
                `Member Count: ${memberCount}`,
                `Last Sync: ${lastSyncTime ? new Date(lastSyncTime).toLocaleString() : 'Never'}`,
                `Equipment: ${equipment.length}`,
                `Maintenance Logs: ${maintenanceLogs.length}`,
                `Consumables: ${consumables.length}`,
                `Intervals: ${intervals.length}`,
                `Service Routines: ${serviceRoutines.length}`,
                `Inspection Routines: ${inspectionRoutines.length}`,
              ].join('\n');
              void Clipboard.setStringAsync(info);
              Alert.alert('Copied', 'Debug info copied to clipboard. Send it to support.');
            }}
          >
            <Copy color="#fff" size={16} />
            <Text style={styles.superAdminButtonText}>Copy Debug Info</Text>
          </TouchableOpacity>
        </View>
      )}

      {isSuperAdmin && (
        <View style={styles.section}>
          <View style={[styles.superAdminHeader, { backgroundColor: colors.statusOverdue + '12' }]}>
            <Lock color={colors.statusOverdue} size={16} />
            <Text style={[styles.sectionTitle, { color: colors.statusOverdue, marginBottom: 0 }]}>Super Admin</Text>
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
                  superAdminPin: effectiveSuperAdminPin,
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
                          superAdminPin: effectiveSuperAdminPin,
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
            <TouchableOpacity
              style={[styles.superAdminButton, { backgroundColor: colors.accent, marginTop: 8 }]}
              onPress={() => {
                const info = [
                  `Farm ID: ${farmId}`,
                  `Device ID: ${deviceId}`,
                  `Display Name: ${displayName || '(none)'}`,
                  `Member Count: ${memberCount}`,
                  `Last Sync: ${lastSyncTime ? new Date(lastSyncTime).toLocaleString() : 'Never'}`,
                  `Equipment: ${equipment.length}`,
                  `Logs: ${maintenanceLogs.length}`,
                  `Consumables: ${consumables.length}`,
                  `Intervals: ${intervals.length}`,
                  `Service Routines: ${serviceRoutines.length}`,
                  `Inspection Routines: ${inspectionRoutines.length}`,
                ].join('\n');
                void Clipboard.setStringAsync(info);
                Alert.alert('Copied', 'Debug info copied to clipboard.');
              }}
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
          )}
        </View>
      )}

      <PaywallModal visible={showPaywall} onDismiss={() => setShowPaywall(false)} />

      <TouchableOpacity style={styles.footer} onPress={handleFooterTap} activeOpacity={0.7}>
        <Text style={[styles.footerText, { color: colors.primary }]}>FarmGuard Maintenance</Text>
        {isSuperAdmin && (
          <Text style={[styles.footerSubtext, { color: colors.statusOverdue }]}>Super Admin Active</Text>
        )}
        {isDebugMode && !isSuperAdmin && (
          <Text style={[styles.footerSubtext, { color: colors.accent }]}>Debug Mode Active</Text>
        )}
      </TouchableOpacity>

      <Modal
        visible={showColorPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowColorPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Choose Color Scheme</Text>
              <TouchableOpacity onPress={() => setShowColorPicker(false)}>
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.schemeList} showsVerticalScrollIndicator={false}>
              {colorSchemes.map((scheme) => (
                <TouchableOpacity
                  key={scheme.id}
                  style={[
                    styles.schemeOption,
                    { backgroundColor: colors.background },
                    currentSchemeId === scheme.id && { borderColor: scheme.primary, borderWidth: 2 },
                  ]}
                  onPress={() => {
                    setColorScheme(scheme.id);
                    setShowColorPicker(false);
                  }}
                >
                  <View style={styles.schemeColors}>
                    <View style={[styles.schemeSwatch, { backgroundColor: scheme.primary }]} />
                    <View style={[styles.schemeSwatch, { backgroundColor: scheme.secondary }]} />
                    <View style={[styles.schemeSwatch, { backgroundColor: scheme.accent }]} />
                  </View>
                  <Text style={[styles.schemeName, { color: colors.text }]}>{scheme.name}</Text>
                  {currentSchemeId === scheme.id && (
                    <Check color={scheme.primary} size={20} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showJoinFarmModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { setShowJoinFarmModal(false); setJoinStep('farm_id'); setJoinPasswordInput(''); setJoinPasswordError(''); }}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalOverlayDismiss} onPress={() => { Keyboard.dismiss(); setShowJoinFarmModal(false); setJoinStep('farm_id'); setJoinPasswordInput(''); setJoinPasswordError(''); }} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                {joinStep === 'password' && (
                  <TouchableOpacity onPress={() => { setJoinStep('farm_id'); setJoinPasswordInput(''); setJoinPasswordError(''); }} style={styles.backButton}>
                    <ChevronRight color={colors.textSecondary} size={20} style={{ transform: [{ rotate: '180deg' }] }} />
                  </TouchableOpacity>
                )}
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {joinStep === 'farm_id' ? 'Join Existing Farm' : 'Farm Password Required'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setShowJoinFarmModal(false); setJoinStep('farm_id'); setJoinPasswordInput(''); setJoinPasswordError(''); }}>
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>

            {joinStep === 'farm_id' ? (
              <>
                <Text style={[styles.joinDescription, { color: colors.textSecondary }]}>
                  Enter the Farm ID shared by another team member to sync data across devices.
                </Text>
                <View style={[styles.joinInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.joinInputText, { color: colors.text }]}
                    placeholder="Enter Farm ID"
                    placeholderTextColor={colors.textSecondary}
                    value={joinFarmId}
                    onChangeText={setJoinFarmId}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </>
            ) : (
              <>
                <View style={[styles.passwordProtectedBanner, { backgroundColor: colors.statusOverdue + '12', borderColor: colors.statusOverdue + '30' }]}>
                  <Lock color={colors.statusOverdue} size={16} />
                  <Text style={[styles.passwordProtectedText, { color: colors.statusOverdue }]}>
                    This farm requires a password to join.
                  </Text>
                </View>
                <Text style={[styles.joinDescription, { color: colors.textSecondary }]}>
                  Ask your farm admin for the join password.
                </Text>
                <View style={[styles.joinInput, { backgroundColor: colors.background, borderColor: joinPasswordError ? colors.statusOverdue : colors.border }]}>
                  <TextInput
                    style={[styles.joinInputText, { color: colors.text }]}
                    placeholder="Enter join password"
                    placeholderTextColor={colors.textSecondary}
                    value={joinPasswordInput}
                    onChangeText={(t) => { setJoinPasswordInput(t); setJoinPasswordError(''); }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                  />
                </View>
                {joinPasswordError ? (
                  <Text style={[styles.farmIdErrorText, { color: colors.statusOverdue }]}>{joinPasswordError}</Text>
                ) : null}
                <TouchableOpacity onPress={() => { setShowForgotPasswordModal(true); setForgotError(''); }}>
                  <Text style={[styles.settingDescription, { color: colors.primary, marginTop: 8 }]}>
                    Forgot password?
                  </Text>
                </TouchableOpacity>
              </>
            )}
            
            <TouchableOpacity 
              style={[styles.joinButton, { backgroundColor: colors.primary }]}
              onPress={handleJoinFarm}
              disabled={isCheckingDuplicates}
            >
              {isCheckingDuplicates ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.joinButtonText}>
                  {joinStep === 'farm_id' ? 'Continue' : 'Join Farm'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showForgotPasswordModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowForgotPasswordModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalOverlayDismiss} onPress={() => { Keyboard.dismiss(); setShowForgotPasswordModal(false); }} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Forgot Farm Password</Text>
              <TouchableOpacity onPress={() => setShowForgotPasswordModal(false)}>
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.joinDescription, { color: colors.textSecondary }]}>
              Request a reset code for this Farm ID, then enter the code from the recovery email.
            </Text>

            <View style={[styles.joinInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput
                style={[styles.joinInputText, { color: colors.text }]}
                placeholder="Farm ID"
                placeholderTextColor={colors.textSecondary}
                value={joinFarmId}
                onChangeText={setJoinFarmId}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[styles.superAdminButton, { backgroundColor: colors.primary, marginTop: 8 }]}
              onPress={handleRequestForgotPassword}
              disabled={requestFarmPasswordResetMutation.isPending}
            >
              {requestFarmPasswordResetMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.superAdminButtonText}>Send Reset Code</Text>
              )}
            </TouchableOpacity>

            <View style={[styles.joinInput, { backgroundColor: colors.background, borderColor: colors.border, marginTop: 10 }]}>
              <TextInput
                style={[styles.joinInputText, { color: colors.text }]}
                placeholder="Reset code"
                placeholderTextColor={colors.textSecondary}
                value={forgotResetCode}
                onChangeText={(t) => { setForgotResetCode(t); setForgotError(''); }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={[styles.joinInput, { backgroundColor: colors.background, borderColor: colors.border, marginTop: 8 }]}>
              <TextInput
                style={[styles.joinInputText, { color: colors.text }]}
                placeholder="New password"
                placeholderTextColor={colors.textSecondary}
                value={forgotNewPassword}
                onChangeText={(t) => { setForgotNewPassword(t); setForgotError(''); }}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
            </View>

            <View style={[styles.joinInput, { backgroundColor: colors.background, borderColor: colors.border, marginTop: 8 }]}>
              <TextInput
                style={[styles.joinInputText, { color: colors.text }]}
                placeholder="Confirm new password"
                placeholderTextColor={colors.textSecondary}
                value={forgotConfirmPassword}
                onChangeText={(t) => { setForgotConfirmPassword(t); setForgotError(''); }}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
            </View>

            {forgotError ? (
              <Text style={[styles.farmIdErrorText, { color: colors.statusOverdue }]}>{forgotError}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.joinButton, { backgroundColor: colors.statusOverdue + 'CC', marginTop: 10 }]}
              onPress={handleCompleteForgotPassword}
              disabled={completeFarmPasswordResetMutation.isPending}
            >
              {completeFarmPasswordResetMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.joinButtonText}>Reset Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showSetPasswordModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSetPasswordModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalOverlayDismiss} onPress={() => { Keyboard.dismiss(); setShowSetPasswordModal(false); }} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Join Password</Text>
              <TouchableOpacity onPress={() => setShowSetPasswordModal(false)}>
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.joinDescription, { color: colors.textSecondary }]}>
              {joinPassword
                ? 'Your farm is password protected. Update or remove the password below.'
                : 'Set a password that members must enter before joining your farm.'}
            </Text>

            {joinPassword && (
              <View style={[styles.passwordProtectedBanner, { backgroundColor: colors.statusOk + '12', borderColor: colors.statusOk + '30' }]}>
                <Lock color={colors.statusOk} size={14} />
                <Text style={[styles.passwordProtectedText, { color: colors.statusOk }]}>Currently password protected</Text>
              </View>
            )}

            <View style={[styles.joinInput, { backgroundColor: colors.background, borderColor: joinPasswordSetError ? colors.statusOverdue : colors.border }]}>
              <TextInput
                style={[styles.joinInputText, { color: colors.text }]}
                placeholder={joinPassword ? 'New password' : 'Set a password'}
                placeholderTextColor={colors.textSecondary}
                value={newJoinPassword}
                onChangeText={(t) => { setNewJoinPassword(t); setJoinPasswordSetError(''); }}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
            </View>

            <View style={[styles.joinInput, { backgroundColor: colors.background, borderColor: joinPasswordSetError ? colors.statusOverdue : colors.border, marginTop: 8 }]}>
              <TextInput
                style={[styles.joinInputText, { color: colors.text }]}
                placeholder="Confirm password"
                placeholderTextColor={colors.textSecondary}
                value={newJoinPasswordConfirm}
                onChangeText={(t) => { setNewJoinPasswordConfirm(t); setJoinPasswordSetError(''); }}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
            </View>

            {joinPasswordSetError ? (
              <Text style={[styles.farmIdErrorText, { color: colors.statusOverdue }]}>{joinPasswordSetError}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.joinButton, { backgroundColor: colors.primary, opacity: isSettingFarmPassword ? 0.7 : 1 }]}
              onPress={handleSaveJoinPassword}
              disabled={isSettingFarmPassword}
            >
              {isSettingFarmPassword ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.joinButtonText}>{joinPassword ? 'Update Password' : 'Set Password'}</Text>
              )}
            </TouchableOpacity>

            {joinPassword && (
              <TouchableOpacity
                style={[styles.removePasswordButton, { borderColor: colors.statusOverdue + '50' }]}
                onPress={handleRemoveJoinPassword}
                disabled={isSettingFarmPassword}
              >
                <Text style={[styles.removePasswordText, { color: colors.statusOverdue }]}>Remove Password</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showEditFarmIdModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditFarmIdModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalOverlayDismiss} onPress={() => { Keyboard.dismiss(); setShowEditFarmIdModal(false); }} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Farm ID</Text>
              <TouchableOpacity onPress={() => setShowEditFarmIdModal(false)}>
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.joinDescription, { color: colors.textSecondary }]}>
              Choose a new Farm ID for your team. Spaces are not allowed. All connected devices will need the new ID to stay synced.
            </Text>
            
            <View style={[
              styles.joinInput, 
              { backgroundColor: colors.background, borderColor: farmIdError ? colors.statusOverdue : colors.border }
            ]}>
              <TextInput
                style={[styles.joinInputText, { color: colors.text }]}
                placeholder="Enter new Farm ID"
                placeholderTextColor={colors.textSecondary}
                value={newFarmId}
                onChangeText={handleNewFarmIdChange}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={[
              styles.joinInput,
              { backgroundColor: colors.background, borderColor: colors.border, marginTop: 12 }
            ]}>
              <TextInput
                style={[styles.joinInputText, { color: colors.text }]}
                placeholder="Optional farm name (e.g., Smith Family Farm)"
                placeholderTextColor={colors.textSecondary}
                value={editFarmName}
                onChangeText={setEditFarmName}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={120}
              />
            </View>

            {farmIdError ? (
              <Text style={[styles.farmIdErrorText, { color: colors.statusOverdue }]}>
                {farmIdError}
              </Text>
            ) : null}
            
            <TouchableOpacity 
              style={[styles.joinButton, { backgroundColor: colors.primary, opacity: isUpdatingFarmId ? 0.7 : 1 }]}
              onPress={handleSaveFarmId}
              disabled={isUpdatingFarmId}
            >
              {isUpdatingFarmId ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.joinButtonText}>Save Farm ID</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.joinButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.statusOverdue, marginTop: 8, opacity: isLeavingFarm ? 0.6 : 1 }]}
              onPress={handleLeaveFarmPress}
              disabled={isLeavingFarm}
            >
              {isLeavingFarm ? (
                <ActivityIndicator size="small" color={colors.statusOverdue} />
              ) : (
                <Text style={[styles.joinButtonText, { color: colors.statusOverdue }]}>Leave Farm Organization</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Admin Transfer Modal — shown when admin leaves and other members exist */}
      <Modal
        visible={showLeaveFarmModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLeaveFarmModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalOverlayDismiss} onPress={() => setShowLeaveFarmModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Transfer Admin Role</Text>
              <TouchableOpacity onPress={() => setShowLeaveFarmModal(false)}>
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.joinDescription, { color: colors.textSecondary }]}>
              You are the admin. Before leaving, choose who should become the new admin. The oldest member is pre-selected.
            </Text>

            <View style={{ gap: 8, marginBottom: 16 }}>
              {otherMembers.map((member) => (
                <TouchableOpacity
                  key={member.device_id}
                  style={[
                    styles.settingRow,
                    { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, borderRadius: 10 },
                    selectedAdminTransfer === member.device_id && { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
                  ]}
                  onPress={() => setSelectedAdminTransfer(member.device_id)}
                >
                  <View style={styles.settingLeft}>
                    <View style={[styles.memberAvatar, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.memberAvatarText, { color: colors.primary }]}>
                        {(member.display_name || member.device_id).charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={[styles.settingLabel, { color: colors.text }]}>
                        {member.display_name || member.device_id.slice(0, 12)}
                      </Text>
                      <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                        {member.role === 'admin' ? 'Admin' : 'Member'} · Joined {new Date(member.joined_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  {selectedAdminTransfer === member.device_id && (
                    <Check color={colors.primary} size={20} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.joinButton, { backgroundColor: colors.statusOverdue, opacity: (!selectedAdminTransfer || isLeavingFarm) ? 0.6 : 1 }]}
              onPress={() => {
                if (!selectedAdminTransfer) return;
                setShowLeaveFarmModal(false);
                confirmLeaveFarm(selectedAdminTransfer);
              }}
              disabled={!selectedAdminTransfer || isLeavingFarm}
            >
              {isLeavingFarm ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.joinButtonText}>Select Admin & Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showDisplayNameModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDisplayNameModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalOverlayDismiss} onPress={() => { Keyboard.dismiss(); setShowDisplayNameModal(false); }} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Set Your Name</Text>
              <TouchableOpacity onPress={() => setShowDisplayNameModal(false)}>
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.joinDescription, { color: colors.textSecondary }]}>
              This name will be visible to other members of your farm so they can identify you.
            </Text>
            
            <View style={[styles.joinInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput
                style={[styles.joinInputText, { color: colors.text }]}
                placeholder="Enter your name"
                placeholderTextColor={colors.textSecondary}
                value={editDisplayName}
                onChangeText={setEditDisplayName}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={50}
              />
            </View>
            
            <TouchableOpacity 
              style={[styles.joinButton, { backgroundColor: colors.primary, opacity: isUpdatingDisplayName ? 0.7 : 1 }]}
              onPress={handleSaveDisplayName}
              disabled={isUpdatingDisplayName}
            >
              {isUpdatingDisplayName ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.joinButtonText}>Save Name</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showDuplicateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDuplicateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.duplicateModalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Resolve Duplicates</Text>
              <TouchableOpacity onPress={() => {
                setShowDuplicateModal(false);
                setDuplicates([]);
                setPendingJoinFarmId('');
              }}>
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.duplicateDescription, { color: colors.textSecondary }]}>
              We found {duplicates.length} item{duplicates.length !== 1 ? 's' : ''} that exist in both your local data and the farm you are joining. Choose how to handle each:
            </Text>
            
            <ScrollView style={styles.duplicateList} showsVerticalScrollIndicator={false}>
              {duplicates.map((item, index) => (
                <View key={index} style={[styles.duplicateItem, { backgroundColor: colors.background }]}>
                  <View style={styles.duplicateHeader}>
                    <View style={[styles.duplicateTypeBadge, { backgroundColor: colors.primary + '20' }]}>
                      <Text style={[styles.duplicateTypeText, { color: colors.primary }]}>
                        {getDuplicateTypeLabel(item.type)}
                      </Text>
                    </View>
                    <Text style={[styles.duplicateName, { color: colors.text }]} numberOfLines={1}>
                      {getDuplicateDisplayName(item)}
                    </Text>
                  </View>
                  
                  <View style={styles.resolutionOptions}>
                    <TouchableOpacity
                      style={[
                        styles.resolutionButton,
                        { borderColor: colors.border },
                        item.resolution === 'keep_local' && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => handleDuplicateResolution(index, 'keep_local')}
                    >
                      <Text style={[
                        styles.resolutionText,
                        { color: colors.text },
                        item.resolution === 'keep_local' && { color: '#fff' },
                      ]}>Keep Mine</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.resolutionButton,
                        { borderColor: colors.border },
                        item.resolution === 'keep_remote' && { backgroundColor: colors.secondary, borderColor: colors.secondary },
                      ]}
                      onPress={() => handleDuplicateResolution(index, 'keep_remote')}
                    >
                      <Text style={[
                        styles.resolutionText,
                        { color: colors.text },
                        item.resolution === 'keep_remote' && { color: '#fff' },
                      ]}>Keep Farm</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.resolutionButton,
                        { borderColor: colors.border },
                        item.resolution === 'keep_both' && { backgroundColor: colors.accent, borderColor: colors.accent },
                      ]}
                      onPress={() => handleDuplicateResolution(index, 'keep_both')}
                    >
                      <Text style={[
                        styles.resolutionText,
                        { color: colors.text },
                        item.resolution === 'keep_both' && { color: '#fff' },
                      ]}>Keep Both</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
            
            <TouchableOpacity 
              style={[styles.applyButton, { backgroundColor: colors.primary }]}
              onPress={handleApplyResolutions}
            >
              <Text style={styles.applyButtonText}>Apply & Join Farm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCreateFarmModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateFarmModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalOverlayDismiss} onPress={() => { Keyboard.dismiss(); setShowCreateFarmModal(false); }} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Custom Farm ID</Text>
              <TouchableOpacity onPress={() => setShowCreateFarmModal(false)}>
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.joinDescription, { color: colors.textSecondary }]}>
              Choose a unique Farm ID. No spaces allowed. Share it with your team to sync data across devices.
            </Text>
            <View style={[styles.joinInput, { backgroundColor: colors.background, borderColor: createFarmError ? colors.statusOverdue : colors.border }]}>
              <TextInput
                style={[styles.joinInputText, { color: colors.text }]}
                placeholder="e.g., SmithFarm2024"
                placeholderTextColor={colors.textSecondary}
                value={newFarmIdToCreate}
                onChangeText={(t) => { setNewFarmIdToCreate(t.replace(/\s/g, '')); setCreateFarmError(''); }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={[styles.joinInput, { backgroundColor: colors.background, borderColor: colors.border, marginTop: 12 }]}>
              <TextInput
                style={[styles.joinInputText, { color: colors.text }]}
                placeholder="Optional farm name (e.g., Smith Family Farm)"
                placeholderTextColor={colors.textSecondary}
                value={newFarmNameToCreate}
                onChangeText={setNewFarmNameToCreate}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={120}
              />
            </View>
            {createFarmError ? (
              <Text style={[styles.farmIdErrorText, { color: colors.statusOverdue }]}>{createFarmError}</Text>
            ) : null}
            <TouchableOpacity
              style={[styles.joinButton, { backgroundColor: colors.primary, opacity: isCreatingFarm ? 0.7 : 1 }]}
              onPress={handleCreateFarm}
              disabled={isCreatingFarm}
            >
              {isCreatingFarm ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.joinButtonText}>Create Farm</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showSuperAdminPinModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSuperAdminPinModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalOverlayDismiss} onPress={() => { Keyboard.dismiss(); setShowSuperAdminPinModal(false); }} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Super Admin</Text>
              <TouchableOpacity onPress={() => setShowSuperAdminPinModal(false)}>
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.joinDescription, { color: colors.textSecondary }]}>
              Enter your admin PIN to unlock advanced controls.
            </Text>
            
            <View style={[
              styles.joinInput, 
              { backgroundColor: colors.background, borderColor: superAdminPinError ? colors.statusOverdue : colors.border }
            ]}>
              <TextInput
                style={[styles.joinInputText, { color: colors.text }]}
                placeholder="Enter PIN"
                placeholderTextColor={colors.textSecondary}
                value={superAdminPin}
                onChangeText={(t) => { setSuperAdminPin(t); setSuperAdminPinError(''); }}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={10}
              />
            </View>

            {superAdminPinError ? (
              <Text style={[styles.farmIdErrorText, { color: colors.statusOverdue }]}>
                {superAdminPinError}
              </Text>
            ) : null}
            
            <TouchableOpacity 
              style={[styles.joinButton, { backgroundColor: colors.statusOverdue }]}
              onPress={handleSuperAdminLogin}
            >
              <Text style={styles.joinButtonText}>Unlock</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showLinkEmployeeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLinkEmployeeModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalOverlayDismiss} onPress={() => setShowLinkEmployeeModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Link Employee</Text>
              <TouchableOpacity onPress={() => setShowLinkEmployeeModal(false)}>
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.joinDescription, { color: colors.textSecondary }]}>
              Link an employee to this device so work orders assigned to them appear on their dashboard.
            </Text>

            {employees.length === 0 ? (
              <Text style={[{ fontSize: 14, textAlign: 'center', paddingVertical: 20 }, { color: colors.textSecondary }]}>
                No employees added yet. Add employees from the Work Orders screen.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 300 }}>
                <TouchableOpacity
                  style={[styles.memberRow, { backgroundColor: colors.background, marginBottom: 4 }]}
                  onPress={async () => {
                    const linkedEmp = employees.find(e => e.linkedDeviceId === linkingMemberDeviceId);
                    if (linkedEmp) {
                      try {
                        await updateEmployee({ id: linkedEmp.id, linkedDeviceId: undefined });
                        Alert.alert('Unlinked', `${linkedEmp.name} has been unlinked from this device.`);
                      } catch (err) {
                        console.error('Error unlinking employee:', err);
                      }
                    }
                    setShowLinkEmployeeModal(false);
                  }}
                >
                  <Text style={[{ fontSize: 14, fontWeight: '500' as const }, { color: colors.textSecondary }]}>None (Unlink)</Text>
                </TouchableOpacity>
                {employees.map(emp => {
                  const isLinked = emp.linkedDeviceId === linkingMemberDeviceId;
                  return (
                    <TouchableOpacity
                      key={emp.id}
                      style={[styles.memberRow, { backgroundColor: isLinked ? colors.primary + '15' : colors.background, marginBottom: 4 }]}
                      onPress={async () => {
                        try {
                          const prevLinked = employees.find(e => e.linkedDeviceId === linkingMemberDeviceId);
                          if (prevLinked && prevLinked.id !== emp.id) {
                            await updateEmployee({ id: prevLinked.id, linkedDeviceId: undefined });
                          }
                          await updateEmployee({ id: emp.id, linkedDeviceId: linkingMemberDeviceId });
                          Alert.alert('Linked', `${emp.name} is now linked to this device.`);
                        } catch (err) {
                          console.error('Error linking employee:', err);
                          Alert.alert('Error', 'Failed to link employee.');
                        }
                        setShowLinkEmployeeModal(false);
                      }}
                    >
                      <View style={styles.memberInfo}>
                        <View style={[styles.memberAvatar, { backgroundColor: colors.primary + '20' }]}>
                          <Text style={[styles.memberAvatarText, { color: colors.primary }]}>
                            {emp.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.memberDetails}>
                          <Text style={[styles.memberDeviceId, { color: colors.text }]}>{emp.name}</Text>
                          {emp.role && <Text style={[styles.memberJoinDate, { color: colors.textSecondary }]}>{emp.role}</Text>}
                        </View>
                      </View>
                      {isLinked && (
                        <View style={[styles.roleBadge, { backgroundColor: colors.primary + '20' }]}>
                          <Text style={[styles.roleBadgeText, { color: colors.primary }]}>Linked</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showFuelExportModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFuelExportModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalOverlayDismiss} onPress={() => { Keyboard.dismiss(); setShowFuelExportModal(false); }} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface, maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Export Fuel Data</Text>
              <TouchableOpacity onPress={() => setShowFuelExportModal(false)}>
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.joinDescription, { color: colors.textSecondary }]}>
              Choose equipment and date range to export fuel usage as an Excel file.
            </Text>

            <Text style={[{ fontSize: 13, fontWeight: '600' as const, marginBottom: 8 }, { color: colors.text }]}>Equipment</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.feedbackCategoryChip, { borderColor: colors.border }, fuelExportEquipmentId === 'all' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setFuelExportEquipmentId('all')}
                >
                  <Text style={[styles.feedbackCategoryChipText, { color: colors.text }, fuelExportEquipmentId === 'all' && { color: '#fff' }]}>All Equipment</Text>
                </TouchableOpacity>
                {equipment.map(eq => (
                  <TouchableOpacity
                    key={eq.id}
                    style={[styles.feedbackCategoryChip, { borderColor: colors.border }, fuelExportEquipmentId === eq.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    onPress={() => setFuelExportEquipmentId(eq.id)}
                  >
                    <Text style={[styles.feedbackCategoryChipText, { color: colors.text }, fuelExportEquipmentId === eq.id && { color: '#fff' }]} numberOfLines={1}>{eq.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={[{ fontSize: 13, fontWeight: '600' as const, marginBottom: 8 }, { color: colors.text }]}>Date Range</Text>
            <View style={[styles.feedbackCategoryRow, { marginBottom: 16 }]}>
              {([['ytd', 'Year to Date'], ['lifetime', 'Lifetime'], ['custom', 'Custom']] as const).map(([val, lbl]) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.feedbackCategoryChip, { borderColor: colors.border }, fuelExportRange === val && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setFuelExportRange(val)}
                >
                  <Text style={[styles.feedbackCategoryChipText, { color: colors.text }, fuelExportRange === val && { color: '#fff' }]}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {fuelExportRange === 'custom' && (
              <View style={{ gap: 8, marginBottom: 16 }}>
                <View style={[styles.joinInput, { backgroundColor: colors.background, borderColor: colors.border, marginBottom: 0 }]}>
                  <TextInput
                    style={[styles.joinInputText, { color: colors.text }]}
                    placeholder="Start date (YYYY-MM-DD)"
                    placeholderTextColor={colors.textSecondary}
                    value={fuelExportStartDate}
                    onChangeText={setFuelExportStartDate}
                  />
                </View>
                <View style={[styles.joinInput, { backgroundColor: colors.background, borderColor: colors.border, marginBottom: 0 }]}>
                  <TextInput
                    style={[styles.joinInputText, { color: colors.text }]}
                    placeholder="End date (YYYY-MM-DD)"
                    placeholderTextColor={colors.textSecondary}
                    value={fuelExportEndDate}
                    onChangeText={setFuelExportEndDate}
                  />
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.joinButton, { backgroundColor: '#059669', flexDirection: 'row', justifyContent: 'center', gap: 8, opacity: isExportingFuel ? 0.7 : 1 }]}
              onPress={handleExportFuelData}
              disabled={isExportingFuel}
            >
              {isExportingFuel ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Download color="#fff" size={18} />
                  <Text style={styles.joinButtonText}>Export Fuel Data</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showManageFuelTypesModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowManageFuelTypesModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalOverlayDismiss} onPress={() => { Keyboard.dismiss(); setShowManageFuelTypesModal(false); }} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Manage Fuel Types</Text>
              <TouchableOpacity onPress={() => setShowManageFuelTypesModal(false)}>
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>

            <Text style={[{ fontSize: 13, fontWeight: '600' as const, color: colors.textSecondary, marginBottom: 8 }]}>Built-in Types</Text>
            {BUILT_IN_FUEL_TYPES.map(ft => (
              <View key={ft.value} style={[styles.memberRow, { backgroundColor: colors.background, marginBottom: 4 }]}>
                <Text style={[{ fontSize: 14, fontWeight: '500' as const }, { color: colors.text }]}>{ft.label}</Text>
              </View>
            ))}

            {customFuelTypes.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={[{ fontSize: 13, fontWeight: '600' as const, color: colors.textSecondary, marginBottom: 8 }]}>Custom Types</Text>
                {customFuelTypes.map(ct => (
                  <View key={ct.id} style={[styles.memberRow, { backgroundColor: colors.background, marginBottom: 4 }]}>
                    <Text style={[{ fontSize: 14, fontWeight: '500' as const, flex: 1 }, { color: colors.text }]}>{ct.name}</Text>
                    <TouchableOpacity
                      style={[styles.removeMemberBtn, { backgroundColor: colors.statusOverdue + '15' }]}
                      onPress={() => handleDeleteCustomFuelType(ct.id, ct.name)}
                    >
                      <X color={colors.statusOverdue} size={14} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={{ marginTop: 16 }}>
              <Text style={[{ fontSize: 13, fontWeight: '600' as const, color: colors.textSecondary, marginBottom: 8 }]}>Add Custom Fuel Type</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={[styles.joinInput, { backgroundColor: colors.background, borderColor: colors.border, flex: 1, marginBottom: 0 }]}>
                  <TextInput
                    style={[styles.joinInputText, { color: colors.text }]}
                    placeholder="e.g., Propane, E85"
                    placeholderTextColor={colors.textSecondary}
                    value={newCustomFuelName}
                    onChangeText={setNewCustomFuelName}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.joinButton, { paddingHorizontal: 20, backgroundColor: '#059669', opacity: !newCustomFuelName.trim() ? 0.5 : 1 }]}
                  onPress={handleAddCustomFuelType}
                  disabled={!newCustomFuelName.trim()}
                >
                  <Text style={[styles.joinButtonText, { fontSize: 14 }]}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ExportRecordsModal
        visible={showExportModal}
        onDismiss={() => setShowExportModal(false)}
      />

      <View style={styles.versionContainer}>
        <Text style={[styles.versionText, { color: colors.textSecondary }]}>
          Version {Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsCard: {
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
  },
  settingDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingBottom: 60,
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  footerSubtext: {
    fontSize: 12,
    marginTop: 4,
  },
  superAdminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  superAdminTabScroll: {
    marginBottom: 12,
    maxHeight: 44,
  },
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
  superAdminTabText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
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
  superAdminButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  debugText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  colorPreview: {
    flexDirection: 'row',
    gap: 4,
    marginRight: 8,
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalOverlayDismiss: {
    flex: 1,
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
  },
  schemeList: {
    paddingBottom: 20,
  },
  schemeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  schemeColors: {
    flexDirection: 'row',
    gap: 6,
    marginRight: 14,
  },
  schemeSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  schemeName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500' as const,
  },
  syncCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  syncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  syncInfo: {
    flex: 1,
  },
  syncTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  syncId: {
    fontSize: 12,
    marginTop: 2,
  },
  farmIdActions: {
    flexDirection: 'row',
    gap: 8,
  },
  farmIdErrorText: {
    fontSize: 13,
    marginTop: -8,
    marginBottom: 12,
  },
  copyButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lastSync: {
    fontSize: 11,
    marginTop: 12,
    textAlign: 'center',
  },
  syncActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  syncButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  joinDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  joinInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  joinInputText: {
    fontSize: 16,
  },
  joinButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  memberCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  memberCountText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  subscriptionStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subscriptionStatusLine: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600' as const,
  },
  duplicateModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  duplicateDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  duplicateList: {
    marginBottom: 16,
  },
  duplicateItem: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  duplicateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  duplicateTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  duplicateTypeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    textTransform: 'uppercase',
  },
  duplicateName: {
    fontSize: 15,
    fontWeight: '600' as const,
    flex: 1,
  },
  resolutionOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  resolutionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  resolutionText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  applyButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  adminIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  adminIndicatorText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  displayNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  displayNameIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  displayNameInfo: {
    flex: 1,
  },
  displayNameLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  displayNameValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginTop: 2,
  },
  membersList: {
    marginTop: 14,
    gap: 6,
  },
  membersListTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  memberInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  memberDetails: {
    flex: 1,
  },
  memberDeviceId: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  memberJoinDate: {
    fontSize: 11,
    marginTop: 2,
  },
  memberBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    textTransform: 'uppercase',
  },
  removeMemberBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  backButton: {
    padding: 2,
  },
  passwordProtectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  passwordProtectedText: {
    fontSize: 13,
    fontWeight: '500' as const,
    flex: 1,
  },
  removePasswordButton: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  removePasswordText: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingBottom: 40,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '400' as const,
  },
  quickStatusGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  quickStatusCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
  },
  quickStatusLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    marginTop: 8,
  },
  quickStatusValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    marginTop: 2,
  },
  feedbackCategoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  feedbackCategoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  feedbackCategoryChipText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
});


