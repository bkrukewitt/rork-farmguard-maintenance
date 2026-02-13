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
  Modal,
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
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { useFarmData } from '@/contexts/FarmDataContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function SettingsScreen() {
  const router = useRouter();
  const { equipment, maintenanceLogs, intervals, consumables, serviceRoutines, inspectionRoutines, getLowStockConsumables } = useFarmData();
  const { colors, colorSchemes, currentSchemeId, setColorScheme, currentScheme } = useTheme();
  const queryClient = useQueryClient();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

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
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
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

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.primary }]}>FarmGuard Maintenance</Text>
      </View>

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
});
