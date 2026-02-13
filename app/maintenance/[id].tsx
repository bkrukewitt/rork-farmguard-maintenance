import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  Wrench,
  AlertCircle,
  ClipboardCheck,
  Clock,
  Calendar,
  User,
  FileText,
  Edit3,
  Trash2,
  ChevronRight,
  Package,
  Eye,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { EquipmentAttachment } from '@/types/equipment';
import { formatDate, formatHours } from '@/utils/helpers';

export default function MaintenanceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    getMaintenanceLogById,
    getEquipmentById,
    deleteMaintenanceLog,
    updateMaintenanceLog,
    isLoading,
  } = useFarmData();

  const log = getMaintenanceLogById(id ?? '');
  const equipment = log ? getEquipmentById(log.equipmentId) : undefined;

  const handleViewAttachment = async (attachment: EquipmentAttachment) => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(attachment.fileUri);
      if (!fileInfo.exists) {
        Alert.alert('File Not Found', 'This file may have been deleted.');
        return;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(attachment.fileUri, {
          dialogTitle: attachment.label,
        });
      } else {
        Alert.alert('Cannot Open', 'File sharing is not available on this device.');
      }
    } catch (error) {
      console.log('Error viewing attachment:', error);
      Alert.alert('Error', 'Failed to open the file.');
    }
  };

  const handleDeleteAttachment = (attachment: EquipmentAttachment) => {
    Alert.alert(
      'Delete File',
      `Are you sure you want to delete "${attachment.label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const fileInfo = await FileSystem.getInfoAsync(attachment.fileUri);
              if (fileInfo.exists) {
                await FileSystem.deleteAsync(attachment.fileUri);
              }

              const updatedAttachments = (log?.attachments ?? []).filter(
                a => a.id !== attachment.id
              );
              await updateMaintenanceLog({
                id: id ?? '',
                attachments: updatedAttachments.length > 0 ? updatedAttachments : undefined,
              });
            } catch (error) {
              console.log('Error deleting attachment:', error);
              Alert.alert('Error', 'Failed to delete the file.');
            }
          },
        },
      ]
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'repair':
        return AlertCircle;
      case 'inspection':
        return ClipboardCheck;
      default:
        return Wrench;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'repair':
        return Colors.statusOverdue;
      case 'inspection':
        return Colors.accent;
      default:
        return Colors.primary;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'routine':
        return 'Routine Service';
      case 'repair':
        return 'Repair';
      case 'inspection':
        return 'Inspection';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  const getPerformerLabel = (performedBy: string) => {
    switch (performedBy) {
      case 'owner':
        return 'Owner';
      case 'dealer':
        return 'Dealer';
      case 'employee':
        return 'Employee';
      default:
        return performedBy;
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Maintenance Log',
      'Are you sure you want to delete this maintenance record? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMaintenanceLog(id ?? '');
              router.back();
            } catch (error) {
              console.log('Error deleting maintenance log:', error);
              Alert.alert('Error', 'Failed to delete maintenance record.');
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

  if (!log) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Maintenance record not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const TypeIcon = getTypeIcon(log.type);
  const typeColor = getTypeColor(log.type);

  return (
    <>
      <Stack.Screen options={{ title: 'Service Details' }} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.typeIconContainer, { backgroundColor: typeColor + '15' }]}>
            <TypeIcon color={typeColor} size={32} />
          </View>
          <View style={[styles.typeBadge, { backgroundColor: typeColor + '20' }]}>
            <Text style={[styles.typeBadgeText, { color: typeColor }]}>
              {getTypeLabel(log.type)}
            </Text>
          </View>
          <Text style={styles.headerDate}>{formatDate(log.date)}</Text>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <View style={styles.card}>
            <Text style={styles.descriptionText}>{log.description}</Text>
          </View>
        </View>

        {/* Equipment Link */}
        {equipment && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Equipment</Text>
            <TouchableOpacity
              style={styles.equipmentCard}
              onPress={() => router.push(`/equipment/${equipment.id}` as any)}
              activeOpacity={0.7}
            >
              <View style={styles.equipmentInfo}>
                <Text style={styles.equipmentName}>{equipment.name}</Text>
                <Text style={styles.equipmentSubtitle}>
                  {equipment.year} {equipment.make} {equipment.model}
                </Text>
              </View>
              <ChevronRight color={Colors.textSecondary} size={20} />
            </TouchableOpacity>
          </View>
        )}

        {/* Service Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Details</Text>
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Calendar color={Colors.textSecondary} size={16} />
              </View>
              <Text style={styles.detailLabel}>Date</Text>
              <Text style={styles.detailValue}>{formatDate(log.date)}</Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Clock color={Colors.textSecondary} size={16} />
              </View>
              <Text style={styles.detailLabel}>Hours at Service</Text>
              <Text style={styles.detailValue}>{formatHours(log.hoursAtService)}</Text>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <User color={Colors.textSecondary} size={16} />
              </View>
              <Text style={styles.detailLabel}>Performed By</Text>
              <Text style={styles.detailValue}>
                {getPerformerLabel(log.performedBy)}
                {log.performedByName ? ` — ${log.performedByName}` : ''}
              </Text>
            </View>

            {log.downtimeHours !== undefined && log.downtimeHours > 0 && (
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <AlertCircle color={Colors.textSecondary} size={16} />
                </View>
                <Text style={styles.detailLabel}>Downtime</Text>
                <Text style={styles.detailValue}>{log.downtimeHours} hours</Text>
              </View>
            )}
          </View>
        </View>

        {/* Parts Used */}
        {log.consumablesUsed && log.consumablesUsed.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Parts & Consumables Used</Text>
            <View style={styles.detailsCard}>
              {log.consumablesUsed.map((item, index) => (
                <View
                  key={`${item.consumableId}-${index}`}
                  style={[
                    styles.partRow,
                    index < log.consumablesUsed.length - 1 && styles.partRowBorder,
                  ]}
                >
                  <View style={styles.partIcon}>
                    <Package color={Colors.primary} size={16} />
                  </View>
                  <View style={styles.partInfo}>
                    <Text style={styles.partName}>{item.name}</Text>
                  </View>
                  <Text style={styles.partQuantity}>×{item.quantity}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Notes */}
        {log.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.card}>
              <Text style={styles.notesText}>{log.notes}</Text>
            </View>
          </View>
        ) : null}

        {/* Attachments */}
        {log.attachments && log.attachments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Attachments</Text>
            <View style={styles.detailsCard}>
              {log.attachments.map((attachment, index) => (
                <View
                  key={attachment.id}
                  style={[
                    styles.attachmentRow,
                    index < (log.attachments?.length ?? 0) - 1 && styles.attachmentRowBorder,
                  ]}
                >
                  <View style={styles.attachmentIcon}>
                    <FileText color={Colors.primary} size={18} />
                  </View>
                  <View style={styles.attachmentInfo}>
                    <Text style={styles.attachmentLabel}>{attachment.label}</Text>
                    <Text style={styles.attachmentFileName} numberOfLines={1}>
                      {attachment.fileName}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.attachmentAction}
                    onPress={() => handleViewAttachment(attachment)}
                  >
                    <Eye color={Colors.primary} size={18} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.attachmentAction}
                    onPress={() => handleDeleteAttachment(attachment)}
                  >
                    <Trash2 color={Colors.statusOverdue} size={18} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push(`/maintenance/edit/${log.id}` as any)}
          >
            <Edit3 color={Colors.textOnPrimary} size={20} />
            <Text style={styles.editButtonText}>Edit Service Record</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
          >
            <Trash2 color={Colors.statusOverdue} size={20} />
            <Text style={styles.deleteButtonText}>Delete Record</Text>
          </TouchableOpacity>
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
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  typeIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  typeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  typeBadgeText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  headerDate: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
  },
  descriptionText: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
  },
  equipmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 14,
  },
  equipmentInfo: {
    flex: 1,
  },
  equipmentName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  equipmentSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  detailsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
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
    maxWidth: '45%',
    textAlign: 'right',
  },
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  partRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  partIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  partInfo: {
    flex: 1,
  },
  partName: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  partQuantity: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginLeft: 8,
  },
  notesText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  actionsSection: {
    paddingHorizontal: 16,
    marginTop: 28,
    gap: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textOnPrimary,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.statusOverdue + '40',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.statusOverdue,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  attachmentRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  attachmentIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  attachmentFileName: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  attachmentAction: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  bottomPadding: {
    height: 40,
  },
});
