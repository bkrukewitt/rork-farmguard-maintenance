import React, { useState } from 'react';
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
  Building2,
  Users,
  LogOut,
  RefreshCw,
  Cloud,
  FolderUp,
  UserPlus,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { CONSUMABLE_CATEGORIES } from '@/types/equipment';

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
    isSyncing,
    lastSyncTime,
    syncEnabled,
    pullFromSupabase,
    migrateLocalData,
  } = useFarmData();
  const { profile, signOut, isAuthenticated, isGuest } = useAuth();
  const { organization, members, userRole } = useOrganization();
  const queryClient = useQueryClient();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

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
                'farmguard_inspection_routines',
              ]);
              queryClient.invalidateQueries();
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
        version: 1,
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
      'Restore Backup',
      'This will replace all your current data with the backup data. This action cannot be undone. Continue?',
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

              if (result.canceled || !result.assets || result.assets.length === 0) {
                setIsRestoring(false);
                return;
              }

              const file = result.assets[0];
              let jsonContent: string;

              if (Platform.OS === 'web') {
                const response = await fetch(file.uri);
                jsonContent = await response.text();
              } else {
                jsonContent = await FileSystem.readAsStringAsync(file.uri, {
                  encoding: FileSystem.EncodingType.UTF8,
                });
              }

              const backupData = JSON.parse(jsonContent);

              if (!backupData.version || !backupData.data) {
                throw new Error('Invalid backup file format');
              }

              const { data } = backupData;

              await AsyncStorage.multiSet([
                ['farmguard_equipment', JSON.stringify(data.equipment || [])],
                ['farmguard_maintenance_logs', JSON.stringify(data.maintenanceLogs || [])],
                ['farmguard_intervals', JSON.stringify(data.intervals || [])],
                ['farmguard_consumables', JSON.stringify(data.consumables || [])],
                ['farmguard_service_routines', JSON.stringify(data.serviceRoutines || [])],
                ['farmguard_inspection_routines', JSON.stringify(data.inspectionRoutines || [])],
              ]);

              queryClient.invalidateQueries();
              Alert.alert('Success', 'Data restored successfully. The app will now reload the data.');
            } catch (error) {
              console.error('Error restoring data:', error);
              Alert.alert('Error', 'Failed to restore backup. Please ensure you selected a valid FarmGuard backup file.');
            } finally {
              setIsRestoring(false);
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
        ['Part Name', 'Part Number', 'Category', 'Supplier', 'Supplier Part Number', 'Quantity', 'Low Stock Threshold', 'Equipment', 'Notes'],
        ...lowStockParts.map(part => {
          const categoryLabel = CONSUMABLE_CATEGORIES.find(c => c.value === part.category)?.label || part.category;
          const equipmentNames = part.compatibleEquipment
            ?.map(id => equipment.find(e => e.id === id)?.name)
            .filter(Boolean)
            .join(', ') || '';

          return [
            part.name,
            part.partNumber,
            categoryLabel,
            part.supplier || '',
            part.supplierPartNumber || '',
            part.quantity,
            part.lowStockThreshold,
            equipmentNames,
            part.notes || '',
          ];
        }),
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

  const handleSync = async () => {
    try {
      await pullFromSupabase();
      Alert.alert('Success', 'Data synced successfully.');
    } catch (err) {
      Alert.alert('Error', 'Failed to sync data. Please try again.');
    }
  };

  const handleMigrateData = () => {
    Alert.alert(
      'Migrate Local Data',
      'This will upload all your existing local data to your farm\'s shared cloud. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Migrate',
          onPress: async () => {
            try {
              setIsMigrating(true);
              await migrateLocalData();
              Alert.alert('Success', 'Local data has been uploaded to your farm.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to migrate data.');
            } finally {
              setIsMigrating(false);
            }
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    if (isGuest) {
      Alert.alert(
        'Exit Guest Mode',
        'You will be taken to the login screen. Your local data will be preserved.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue',
            onPress: async () => {
              try {
                await signOut();
              } catch (err) {
                console.log('Guest exit error:', err);
              }
            },
          },
        ]
      );
      return;
    }
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (err) {
              console.log('Sign out error:', err);
            }
          },
        },
      ]
    );
  };

  const formattedSyncTime = lastSyncTime
    ? new Date(lastSyncTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
    : 'Never';

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {isGuest ? (
        <TouchableOpacity
          style={styles.guestBanner}
          onPress={() => router.push('/(auth)/login' as any)}
          activeOpacity={0.8}
        >
          <View style={styles.guestBannerLeft}>
            <View style={styles.guestIconCircle}>
              <UserPlus color={Colors.primary} size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.guestBannerTitle}>Using as Guest</Text>
              <Text style={styles.guestBannerDesc}>
                Create an account to sync data, join a farm, and collaborate with your team
              </Text>
            </View>
          </View>
          <ChevronRight color={Colors.primary} size={20} />
        </TouchableOpacity>
      ) : (
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileInitial}>
              {(profile?.full_name || profile?.email || '?')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.full_name || 'User'}</Text>
            <Text style={styles.profileEmail}>{profile?.email || ''}</Text>
            {organization && (
              <View style={styles.orgBadge}>
                <Building2 color={Colors.primary} size={12} />
                <Text style={styles.orgBadgeText}>{organization.name}</Text>
                {userRole && (
                  <View style={[styles.rolePill, { backgroundColor: userRole === 'owner' ? Colors.accent + '20' : Colors.primary + '20' }]}>
                    <Text style={[styles.roleText, { color: userRole === 'owner' ? Colors.accent : Colors.primary }]}>
                      {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      )}

      {isAuthenticated && !organization && !isGuest && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Farm</Text>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/organization/setup' as any)}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.primary + '15' }]}>
                <Building2 color={Colors.primary} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Set Up Farm</Text>
                <Text style={styles.settingDescription}>Create or join a farm to sync and collaborate</Text>
              </View>
            </View>
            <ChevronRight color={Colors.textSecondary} size={20} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.statsCard}>
        <View style={styles.statsHeader}>
          <Tractor color={Colors.primary} size={24} />
          <Text style={styles.statsTitle}>Farm Stats</Text>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{equipment.length}</Text>
            <Text style={styles.statLabel}>Equipment</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{maintenanceLogs.length}</Text>
            <Text style={styles.statLabel}>Service Logs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{members.length}</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
        </View>
      </View>

      {syncEnabled && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sync</Text>

          <View style={styles.syncStatusRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: isSyncing ? Colors.accent + '15' : Colors.success + '15' }]}>
                {isSyncing ? (
                  <RefreshCw color={Colors.accent} size={20} />
                ) : (
                  <Cloud color={Colors.success} size={20} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>
                  {isSyncing ? 'Syncing...' : 'Connected'}
                </Text>
                <Text style={styles.settingDescription}>Last sync: {formattedSyncTime}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.syncButton}
              onPress={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <RefreshCw color={Colors.primary} size={18} />
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={handleMigrateData}
            disabled={isMigrating}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#8B5CF6' + '15' }]}>
                <FolderUp color="#8B5CF6" size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Upload Local Data</Text>
                <Text style={styles.settingDescription}>Push existing data to shared farm</Text>
              </View>
            </View>
            {isMigrating ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <ChevronRight color={Colors.textSecondary} size={20} />
            )}
          </TouchableOpacity>
        </View>
      )}

      {organization && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Farm</Text>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/organization/manage' as any)}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.primary + '15' }]}>
                <Users color={Colors.primary} size={20} />
              </View>
              <View>
                <Text style={styles.settingLabel}>Manage Farm</Text>
                <Text style={styles.settingDescription}>
                  {members.length} member{members.length !== 1 ? 's' : ''} • Invite code & roles
                </Text>
              </View>
            </View>
            <ChevronRight color={Colors.textSecondary} size={20} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Service</Text>
        
        <TouchableOpacity 
          style={styles.settingRow} 
          onPress={() => router.push('/routines' as any)}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: Colors.primary + '15' }]}>
              <ClipboardList color={Colors.primary} size={20} />
            </View>
            <View>
              <Text style={styles.settingLabel}>Service Routines</Text>
              <Text style={styles.settingDescription}>
                {serviceRoutines.length} routine{serviceRoutines.length !== 1 ? 's' : ''} created
              </Text>
            </View>
          </View>
          <ChevronRight color={Colors.textSecondary} size={20} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingRow} 
          onPress={() => router.push('/routines/inspection' as any)}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: '#8B5CF6' + '15' }]}>
              <Search color="#8B5CF6" size={20} />
            </View>
            <View>
              <Text style={styles.settingLabel}>Inspection Routines</Text>
              <Text style={styles.settingDescription}>
                {inspectionRoutines.length} routine{inspectionRoutines.length !== 1 ? 's' : ''} created
              </Text>
            </View>
          </View>
          <ChevronRight color={Colors.textSecondary} size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: Colors.accent + '15' }]}>
              <Bell color={Colors.accent} size={20} />
            </View>
            <View>
              <Text style={styles.settingLabel}>Maintenance Reminders</Text>
              <Text style={styles.settingDescription}>Get notified when service is due</Text>
            </View>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: Colors.border, true: Colors.primary + '60' }}
            thumbColor={notificationsEnabled ? Colors.primary : Colors.textSecondary}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Management</Text>
        
        <TouchableOpacity style={styles.settingRow} onPress={handleExportData}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: Colors.primary + '15' }]}>
              <FileText color={Colors.primary} size={20} />
            </View>
            <View>
              <Text style={styles.settingLabel}>Export Records</Text>
              <Text style={styles.settingDescription}>Download maintenance history as PDF</Text>
            </View>
          </View>
          <ChevronRight color={Colors.textSecondary} size={20} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingRow} 
          onPress={handleExportLowStockParts}
          disabled={isExporting}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: Colors.accent + '15' }]}>
              <Download color={Colors.accent} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Export Low Stock Parts</Text>
              <Text style={styles.settingDescription}>Download parts inventory as Excel</Text>
            </View>
          </View>
          {isExporting ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <ChevronRight color={Colors.textSecondary} size={20} />
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingRow} 
          onPress={handleBackupData}
          disabled={isBackingUp}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: Colors.statusOk + '15' }]}>
              <Database color={Colors.statusOk} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Backup Data</Text>
              <Text style={styles.settingDescription}>Export all data as JSON file</Text>
            </View>
          </View>
          {isBackingUp ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <ChevronRight color={Colors.textSecondary} size={20} />
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingRow} 
          onPress={handleRestoreData}
          disabled={isRestoring}
        >
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: '#3B82F6' + '15' }]}>
              <Upload color="#3B82F6" size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Restore Backup</Text>
              <Text style={styles.settingDescription}>Import data from JSON file</Text>
            </View>
          </View>
          {isRestoring ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <ChevronRight color={Colors.textSecondary} size={20} />
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingRow} onPress={handleClearData}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: Colors.statusOverdue + '15' }]}>
              <Trash2 color={Colors.statusOverdue} size={20} />
            </View>
            <View>
              <Text style={[styles.settingLabel, { color: Colors.statusOverdue }]}>
                Clear All Data
              </Text>
              <Text style={styles.settingDescription}>Delete all equipment and logs</Text>
            </View>
          </View>
          <ChevronRight color={Colors.textSecondary} size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: Colors.secondary + '15' }]}>
              <Shield color={Colors.secondary} size={20} />
            </View>
            <View>
              <Text style={styles.settingLabel}>Privacy Policy</Text>
              <Text style={styles.settingDescription}>
                {isGuest ? 'Data stored locally on device' : 'Data synced to your private farm'}
              </Text>
            </View>
          </View>
          <ChevronRight color={Colors.textSecondary} size={20} />
        </View>

        {isGuest ? (
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/(auth)/login' as any)}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.primary + '15' }]}>
                <UserPlus color={Colors.primary} size={20} />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: Colors.primary }]}>Create Account / Sign In</Text>
                <Text style={styles.settingDescription}>Enable sync & farm collaboration</Text>
              </View>
            </View>
            <ChevronRight color={Colors.primary} size={20} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.signOutRow} onPress={handleSignOut}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.danger + '10' }]}>
                <LogOut color={Colors.danger} size={20} />
              </View>
              <Text style={[styles.settingLabel, { color: Colors.danger }]}>Sign Out</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>FarmGuard Maintenance</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary + '08',
    margin: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: Colors.primary + '20',
  },
  guestBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  guestIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestBannerTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  guestBannerDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    margin: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 18,
    gap: 14,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  profileEmail: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  orgBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  orgBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '700' as const,
  },
  statsCard: {
    backgroundColor: Colors.surface,
    margin: 16,
    marginTop: 8,
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.cardShadow,
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
    color: Colors.text,
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
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.borderLight,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  syncStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  syncButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
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
    color: Colors.text,
  },
  settingDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger + '06',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.danger + '15',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingBottom: 60,
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
});
