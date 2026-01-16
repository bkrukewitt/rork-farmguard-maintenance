import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { 
  Tractor, 
  Truck, 
  Wheat, 
  Wrench, 
  Droplets, 
  Sprout, 
  Container, 
  Settings,
  Clock,
  Calendar,
  Hash,
  AlertTriangle,
  CheckCircle,
  Edit3,
  Trash2,
  Plus,
  FileText,
  Fan,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { EquipmentType } from '@/types/equipment';
import { formatDate, formatHours, getMaintenanceStatus } from '@/utils/helpers';

const EQUIPMENT_ICONS: Record<EquipmentType, React.ComponentType<{ color: string; size: number }>> = {
  tractor: Tractor,
  combine: Wheat,
  truck: Truck,
  implement: Wrench,
  sprayer: Droplets,
  planter: Sprout,
  loader: Container,
  mower: Fan,
  other: Settings,
};

export default function EquipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { 
    getEquipmentById, 
    getLogsForEquipment, 
    getIntervalsForEquipment,
    deleteEquipment,
    isLoading,
  } = useFarmData();

  const equipment = getEquipmentById(id ?? '');
  const logs = getLogsForEquipment(id ?? '');
  const intervals = getIntervalsForEquipment(id ?? '');

  const maintenanceStatus = useMemo(() => {
    if (!equipment) return [];
    
    return intervals.map(interval => {
      const status = getMaintenanceStatus(
        interval.lastPerformedHours,
        equipment.currentHours,
        interval.intervalHours,
        interval.lastPerformedDate,
        interval.intervalDays
      );
      
      let nextDue: string | null = null;
      if (interval.intervalHours && interval.lastPerformedHours !== undefined) {
        nextDue = `${(interval.lastPerformedHours + interval.intervalHours).toLocaleString()} hrs`;
      } else if (interval.intervalDays && interval.lastPerformedDate) {
        const nextDate = new Date(interval.lastPerformedDate);
        nextDate.setDate(nextDate.getDate() + interval.intervalDays);
        nextDue = formatDate(nextDate.toISOString());
      }
      
      return { ...interval, status, nextDue };
    });
  }, [equipment, intervals]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Equipment',
      `Are you sure you want to delete "${equipment?.name}"? This will also delete all maintenance records for this equipment.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEquipment(id ?? '');
              router.back();
            } catch (error) {
              console.log('Error deleting equipment:', error);
              Alert.alert('Error', 'Failed to delete equipment');
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!equipment) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Equipment not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const Icon = EQUIPMENT_ICONS[equipment.type] || Settings;

  return (
    <>
      <Stack.Screen options={{ title: equipment.name }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {equipment.imageUrl ? (
          <View style={styles.imageHeader}>
            <Image source={{ uri: equipment.imageUrl }} style={styles.headerImage} />
            <View style={styles.imageOverlay} />
            <View style={styles.imageHeaderContent}>
              <Text style={styles.imageEquipmentName}>{equipment.name}</Text>
              <Text style={styles.imageEquipmentDetails}>
                {equipment.year} {equipment.make} {equipment.model}
              </Text>
              <View style={styles.imageHoursContainer}>
                <Clock color="#fff" size={18} />
                <Text style={styles.imageHoursText}>{formatHours(equipment.currentHours)}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Icon color={Colors.primary} size={48} />
            </View>
            <Text style={styles.equipmentName}>{equipment.name}</Text>
            <Text style={styles.equipmentDetails}>
              {equipment.year} {equipment.make} {equipment.model}
            </Text>
            <View style={styles.hoursContainer}>
              <Clock color={Colors.accent} size={18} />
              <Text style={styles.hoursText}>{formatHours(equipment.currentHours)}</Text>
            </View>
          </View>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push(`/maintenance/add?equipmentId=${equipment.id}` as any)}
          >
            <Plus color={Colors.primary} size={20} />
            <Text style={styles.actionButtonText}>Log Service</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push(`/equipment/edit/${equipment.id}` as any)}
          >
            <Edit3 color={Colors.primary} size={20} />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDelete}
          >
            <Trash2 color={Colors.statusOverdue} size={20} />
            <Text style={[styles.actionButtonText, { color: Colors.statusOverdue }]}>Delete</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Equipment Details</Text>
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Hash color={Colors.textSecondary} size={16} />
              </View>
              <Text style={styles.detailLabel}>Serial Number</Text>
              <Text style={styles.detailValue}>{equipment.serialNumber || '—'}</Text>
            </View>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Calendar color={Colors.textSecondary} size={16} />
              </View>
              <Text style={styles.detailLabel}>Purchase Date</Text>
              <Text style={styles.detailValue}>
                {equipment.purchaseDate ? formatDate(equipment.purchaseDate) : '—'}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <FileText color={Colors.textSecondary} size={16} />
              </View>
              <Text style={styles.detailLabel}>Service Records</Text>
              <Text style={styles.detailValue}>{logs.length}</Text>
            </View>
          </View>
        </View>

        {equipment.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{equipment.notes}</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Maintenance Schedule</Text>
          {maintenanceStatus.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No maintenance schedules set</Text>
            </View>
          ) : (
            maintenanceStatus.map(item => {
              const StatusIcon = item.status === 'overdue' ? AlertTriangle :
                                item.status === 'due' ? Clock : CheckCircle;
              const statusColor = item.status === 'overdue' ? Colors.statusOverdue :
                                  item.status === 'due' ? Colors.statusDue : Colors.statusOk;
              
              return (
                <View key={item.id} style={styles.scheduleCard}>
                  <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
                  <View style={styles.scheduleContent}>
                    <Text style={styles.scheduleName}>{item.name}</Text>
                    <Text style={styles.scheduleInterval}>
                      {item.intervalHours ? `Every ${item.intervalHours} hours` : 
                       item.intervalDays ? `Every ${item.intervalDays} days` : '—'}
                    </Text>
                  </View>
                  <View style={styles.scheduleRight}>
                    <StatusIcon color={statusColor} size={18} />
                    {item.nextDue && (
                      <Text style={[styles.nextDue, { color: statusColor }]}>
                        Due: {item.nextDue}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service History</Text>
          {logs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Wrench color={Colors.textSecondary} size={32} />
              <Text style={styles.emptyText}>No service records yet</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push(`/maintenance/add?equipmentId=${equipment.id}` as any)}
              >
                <Text style={styles.emptyButtonText}>Log First Service</Text>
              </TouchableOpacity>
            </View>
          ) : (
            logs.slice(0, 10).map(log => (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <Text style={styles.logDate}>{formatDate(log.date)}</Text>
                  <Text style={[
                    styles.logType,
                    { color: log.type === 'repair' ? Colors.statusOverdue : Colors.primary }
                  ]}>
                    {log.type.charAt(0).toUpperCase() + log.type.slice(1)}
                  </Text>
                </View>
                <Text style={styles.logDescription}>{log.description}</Text>
                <View style={styles.logMeta}>
                  <Text style={styles.logMetaText}>@ {formatHours(log.hoursAtService)}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  backButtonText: {
    color: Colors.textOnPrimary,
    fontWeight: '600' as const,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  equipmentName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  equipmentDetails: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  hoursContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.accent + '15',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  hoursText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.accent,
  },
  actionsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  deleteButton: {
    borderColor: Colors.statusOverdue + '30',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  detailsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailLabel: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  notesCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  notesText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  scheduleContent: {
    flex: 1,
  },
  scheduleName: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  scheduleInterval: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  scheduleRight: {
    alignItems: 'flex-end',
  },
  nextDue: {
    fontSize: 12,
    fontWeight: '500' as const,
    marginTop: 4,
  },
  logCard: {
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logDate: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  logType: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  logDescription: {
    fontSize: 15,
    color: Colors.text,
    marginBottom: 8,
  },
  logMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  logMetaText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  logCost: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: '500' as const,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 12,
  },
  emptyButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textOnPrimary,
  },
  bottomPadding: {
    height: 40,
  },
  imageHeader: {
    position: 'relative',
    width: '100%',
    height: 250,
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  imageHeaderContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  imageEquipmentName: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  imageEquipmentDetails: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 12,
  },
  imageHoursContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  imageHoursText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
