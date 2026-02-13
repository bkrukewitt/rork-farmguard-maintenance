import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { 
  Tractor, 
  Bell, 
  Database,
  Trash2,
  FileText,
  Info,
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
import * as DocumentPicker from 'expo-document-picker';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';

export default function SettingsScreen() {
  const router = useRouter();
  const { equipment, maintenanceLogs, serviceRoutines, inspectionRoutines, consumables } = useFarmData();
  const queryClient = useQueryClient();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

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
      // Get all data from AsyncStorage
      const keys = [
        'farmguard_equipment',
        'farmguard_maintenance_logs',
        'farmguard_intervals',
        'farmguard_consumables',
        'farmguard_service_routines',
        'farmguard_inspection_routines',
      ];
      
      const data = await AsyncStorage.multiGet(keys);
      
      // Create backup object
      const backup = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: data.reduce((acc, [key, value]) => {
          acc[key] = value ? JSON.parse(value) : null;
          return acc;
        }, {} as Record<string, any>),
      };

      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const filename = `farmguard-backup-${timestamp}.json`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      // Write to file
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backup, null, 2));

      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Save FarmGuard Backup',
          UTI: 'public.json',
        });
        Alert.alert('Success', 'Backup file created! Save it to your cloud storage or email it to yourself.');
      } else {
        Alert.alert('Error', 'Sharing is not available on this device.');
      }
    } catch (error) {
      console.error('Backup error:', error);
      Alert.alert('Error', 'Failed to create backup. Please try again.');
    }
  };

  const handleRestoreData = async () => {
    Alert.alert(
      'Restore from Backup',
      'This will replace all current data with the backup. Make sure you have a backup of your current data first.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Choose Backup File',
          onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true,
              });

              if (result.canceled) {
                return;
              }

              const fileUri = result.assets[0].uri;
              
              // Read the backup file
              const fileContent = await FileSystem.readAsStringAsync(fileUri);
              const backup = JSON.parse(fileContent);

              // Validate backup structure
              if (!backup.version || !backup.data) {
                Alert.alert('Error', 'Invalid backup file format.');
                return;
              }

              // Restore data to AsyncStorage
              const entries = Object.entries(backup.data).map(([key, value]) => [
                key,
                JSON.stringify(value),
              ]);

              await AsyncStorage.multiSet(entries as [string, string][]);
              
              // Invalidate all queries to reload data
              queryClient.invalidateQueries();

              Alert.alert('Success', 'Data restored successfully! The app will now refresh.');
            } catch (error) {
              console.error('Restore error:', error);
              Alert.alert('Error', 'Failed to restore backup. Make sure you selected a valid FarmGuard backup file.');
            }
          },
        },
      ]
    );
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

        <TouchableOpacity style={styles.settingRow} onPress={handleBackupData}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: Colors.statusOk + '15' }]}>
              <Upload color={Colors.statusOk} size={20} />
            </View>
            <View>
              <Text style={styles.settingLabel}>Backup Data</Text>
              <Text style={styles.settingDescription}>Export data to save anywhere</Text>
            </View>
          </View>
          <ChevronRight color={Colors.textSecondary} size={20} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingRow} onPress={handleRestoreData}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: '#3B82F6' + '15' }]}>
              <Download color="#3B82F6" size={20} />
            </View>
            <View>
              <Text style={styles.settingLabel}>Restore Data</Text>
              <Text style={styles.settingDescription}>Import data from backup file</Text>
            </View>
          </View>
          <ChevronRight color={Colors.textSecondary} size={20} />
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
