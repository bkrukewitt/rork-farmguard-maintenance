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
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';

export default function SettingsScreen() {
  const router = useRouter();
  const { equipment, maintenanceLogs, intervals, consumables, serviceRoutines, inspectionRoutines, getLowStockConsumables } = useFarmData();
  const queryClient = useQueryClient();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

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

              queryClient.invalidateQueries();

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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.statsCard}>
        <View style={styles.statsHeader}>
          <Tractor color={Colors.primary} size={24} />
          <Text style={styles.statsTitle}>Your Farm Stats</Text>
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
        </View>
      </View>

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
            <View style={[styles.settingIcon, { backgroundColor: Colors.secondary + '15' }]}>
              <Upload color={Colors.secondary} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Restore Data</Text>
              <Text style={styles.settingDescription}>Import from backup file</Text>
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
        <Text style={styles.sectionTitle}>About</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: Colors.secondary + '15' }]}>
              <Shield color={Colors.secondary} size={20} />
            </View>
            <View>
              <Text style={styles.settingLabel}>Privacy Policy</Text>
              <Text style={styles.settingDescription}>Your data stays on your device</Text>
            </View>
          </View>
          <ChevronRight color={Colors.textSecondary} size={20} />
        </View>

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
  statsCard: {
    backgroundColor: Colors.surface,
    margin: 16,
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
  footerSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
});
