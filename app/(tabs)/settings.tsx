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
  Bug,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { getErrorLogs, formatErrorLogsAsText, clearErrorLogs } from '@/utils/errorLogger';

export default function SettingsScreen() {
  const router = useRouter();
  const { equipment, maintenanceLogs, serviceRoutines, inspectionRoutines } = useFarmData();
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

  const handleExportErrorLogs = async () => {
    try {
      const logs = await getErrorLogs();
      
      if (logs.length === 0) {
        Alert.alert('No Logs', 'There are no error logs to export.');
        return;
      }

      const logText = formatErrorLogsAsText(logs);
      const fileName = `farmguard-error-logs-${new Date().toISOString().split('T')[0]}.txt`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

      // Write file
      await FileSystem.writeAsStringAsync(fileUri, logText, {
        encoding: 'utf8',
      });

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: 'Export Error Logs',
        });
      } else {
        Alert.alert(
          'Export Complete',
          `Error logs saved to: ${fileUri}\n\nTotal entries: ${logs.length}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error exporting logs:', error);
      Alert.alert(
        'Export Failed',
        `Failed to export error logs: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  const handleClearErrorLogs = () => {
    Alert.alert(
      'Clear Error Logs',
      'This will permanently delete all error logs. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Logs',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearErrorLogs();
              Alert.alert('Success', 'Error logs have been cleared.');
            } catch (error) {
              console.error('Error clearing logs:', error);
              Alert.alert('Error', 'Failed to clear error logs. Please try again.');
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

        <TouchableOpacity style={styles.settingRow} onPress={() => {}}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: Colors.statusOk + '15' }]}>
              <Database color={Colors.statusOk} size={20} />
            </View>
            <View>
              <Text style={styles.settingLabel}>Backup Data</Text>
              <Text style={styles.settingDescription}>Sync to cloud storage</Text>
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
        <Text style={styles.sectionTitle}>Debug</Text>
        
        <TouchableOpacity style={styles.settingRow} onPress={handleExportErrorLogs}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: '#F59E0B' + '15' }]}>
              <Bug color="#F59E0B" size={20} />
            </View>
            <View>
              <Text style={styles.settingLabel}>Export Error Logs</Text>
              <Text style={styles.settingDescription}>Download error logs as text file</Text>
            </View>
          </View>
          <ChevronRight color={Colors.textSecondary} size={20} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingRow} onPress={handleClearErrorLogs}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: Colors.statusOverdue + '15' }]}>
              <Trash2 color={Colors.statusOverdue} size={20} />
            </View>
            <View>
              <Text style={[styles.settingLabel, { color: Colors.statusOverdue }]}>
                Clear Error Logs
              </Text>
              <Text style={styles.settingDescription}>Delete all error logs</Text>
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

        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: Colors.textSecondary + '15' }]}>
              <Info color={Colors.textSecondary} size={20} />
            </View>
            <View>
              <Text style={styles.settingLabel}>Version</Text>
              <Text style={styles.settingDescription}>1.0.0</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>FarmGuard Maintenance</Text>
        <Text style={styles.footerSubtext}>Keep your equipment running strong</Text>
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
