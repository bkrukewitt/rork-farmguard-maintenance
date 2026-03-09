import React, { useState, useRef, useCallback } from 'react';
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
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
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
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { useFarmData, DuplicateItem, FarmMember, fetchFarmPasswordForId } from '@/contexts/FarmDataContext';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { Equipment, Consumable, ServiceRoutine, InspectionRoutine } from '@/types/equipment';
import { User } from 'lucide-react-native';

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
    deviceId,
    setFarmId,
    isSyncing,
    lastSyncTime,
    syncToServer,
    memberCount,
    isAdmin,
    farmMembers,
    removeMember,
    updateFarmId,
    isUpdatingFarmId,
    displayName,
    updateDisplayName,
    isUpdatingDisplayName,
    checkForDuplicatesOnJoin,
    applyDuplicateResolutions,
    deleteFarmFromServer,
    isDeletingFarm,
    forceDeleteEquipment,
    forceDeleteConsumables,
    purgeAndResync,
    isPurging,
    refreshData,
    joinPassword,
    setFarmPassword,
    isSettingFarmPassword,
    createFarm,
    isCreatingFarm,
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
  const [joinFarmId, setJoinFarmId] = useState('');
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateItem[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [pendingJoinFarmId, setPendingJoinFarmId] = useState('');
  const [showEditFarmIdModal, setShowEditFarmIdModal] = useState(false);
  const [newFarmId, setNewFarmId] = useState('');
  const [farmIdError, setFarmIdError] = useState('');
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
  const [createFarmError, setCreateFarmError] = useState<string>('');
  const [adminFarmIdLookup, setAdminFarmIdLookup] = useState<string>('');
  const [adminFarmMembers, setAdminFarmMembers] = useState<FarmMember[]>([]);
  const [isFetchingAdminMembers, setIsFetchingAdminMembers] = useState<boolean>(false);
  const [adminMembersError, setAdminMembersError] = useState<string>('');
  const [isUpdatingAdminMember, setIsUpdatingAdminMember] = useState<string | null>(null);
  const [joinStep, setJoinStep] = useState<'farm_id' | 'password'>('farm_id');
  const [joinPasswordInput, setJoinPasswordInput] = useState('');
  const [joinPasswordError, setJoinPasswordError] = useState('');
  const [pendingFarmPassword, setPendingFarmPassword] = useState<string | null>(null);
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [newJoinPassword, setNewJoinPassword] = useState('');
  const [newJoinPasswordConfirm, setNewJoinPasswordConfirm] = useState('');
  const [joinPasswordSetError, setJoinPasswordSetError] = useState('');

  const SUPER_ADMIN_PIN = '9173';
  const DEBUG_PIN = '1847';

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
      await createFarm(trimmed);
      setShowCreateFarmModal(false);
      setNewFarmIdToCreate('');
      setCreateFarmError('');
      Alert.alert('Farm Created', `Farm ID "${trimmed}" is ready. Share it with your team to sync data across devices.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create farm.';
      setCreateFarmError(msg);
    }
  };

  const handleGenerateAndCreateFarm = async () => {
    try {
      const result = await createFarm(undefined);
      setShowCreateFarmModal(false);
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

  const handleExportData = () => {
    Alert.alert(
      'Export Data',
      'Data export as PDF will be available in a future update. Your maintenance history will be exportable for resale documentation and warranty claims.',
      [{ text: 'OK' }]
    );
  };

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

  const handleSaveFarmId = async () => {
    const error = validateFarmId(newFarmId);
    if (error) {
      setFarmIdError(error);
      return;
    }

    Alert.alert(
      'Change Farm ID',
      `Are you sure you want to change the Farm ID to "${newFarmId.trim()}"? All connected devices will need to use the new ID.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change',
          onPress: async () => {
            try {
              await updateFarmId(newFarmId.trim());
              setShowEditFarmIdModal(false);
              setNewFarmId('');
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
        const password = await fetchFarmPasswordForId(joinFarmId.trim());
        setPendingFarmPassword(password);
        if (password) {
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
      if (joinPasswordInput.trim() !== pendingFarmPassword) {
        setJoinPasswordError('Incorrect password. Please try again.');
        return;
      }
      setJoinPasswordError('');
      await proceedWithJoin(joinFarmId.trim());
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
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Cloud Sync</Text>
        
        <View style={[styles.syncCard, { backgroundColor: colors.surface }]}>
          <View style={styles.syncHeader}>
            <Cloud color={colors.primary} size={24} />
            <View style={styles.syncInfo}>
              <Text style={[styles.syncTitle, { color: colors.text }]}>Farm ID</Text>
              <Text style={[styles.syncId, { color: farmId ? colors.textSecondary : colors.statusDue }]} numberOfLines={1}>
                {farmId || 'Not configured'}
              </Text>
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
                  {isAdmin && member.device_id !== deviceId && member.role !== 'admin' && (
                    <TouchableOpacity
                      onPress={() => handleRemoveMember(member.device_id)}
                      style={[styles.removeMemberBtn, { backgroundColor: colors.statusOverdue + '15' }]}
                    >
                      <X color={colors.statusOverdue} size={16} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
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
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Service</Text>
        
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
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Data Management</Text>
        
        <TouchableOpacity style={[styles.settingRow, { backgroundColor: colors.surface }]} onPress={handleExportData}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.primary + '15' }]}>
              <FileText color={colors.primary} size={20} />
            </View>
            <View>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Export Records</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Download maintenance history as PDF</Text>
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

        <TouchableOpacity style={[styles.settingRow, { backgroundColor: colors.surface }]} onPress={handleClearData}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.statusOverdue + '15' }]}>
              <Trash2 color={colors.statusOverdue} size={20} />
            </View>
            <View>
              <Text style={[styles.settingLabel, { color: colors.statusOverdue }]}>
                Clear All Data
              </Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Delete all equipment and logs</Text>
            </View>
          </View>
          <ChevronRight color={colors.textSecondary} size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>About</Text>
        
        <View style={[styles.settingRow, { backgroundColor: colors.surface }]}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: colors.secondary + '15' }]}>
              <Shield color={colors.secondary} size={20} />
            </View>
            <View>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Privacy Policy</Text>
              <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>Your data stays on your device</Text>
            </View>
          </View>
          <ChevronRight color={colors.textSecondary} size={20} />
        </View>

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
          </View>
        </View>
      )}

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
});
