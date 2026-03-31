import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  TextInput,
  Platform,
  InteractionManager,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
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
  Paperclip,
  Eye,
  Droplet,
  CarFront,
  Fuel,
  Copy,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { useTheme } from '@/contexts/ThemeContext';
import { EquipmentType, EquipmentAttachment } from '@/types/equipment';
import { uploadAttachment, getAttachmentPublicUrl } from '@/utils/attachmentUpload';
import { formatDate, formatMetric, getMaintenanceStatus, generateId } from '@/utils/helpers';
import { generateMaintenancePdf, shareFile, getDateRangeForPreset } from '@/utils/exportHelpers';
import { Download } from 'lucide-react-native';

const EQUIPMENT_ICONS: Record<EquipmentType, React.ComponentType<{ color: string; size: number }>> = {
  tractor: Tractor,
  combine: Wheat,
  truck: Truck,
  implement: Wrench,
  sprayer: Droplets,
  planter: Sprout,
  loader: Container,
  mower: Fan,
  utv: CarFront,
  other: Settings,
};

export default function EquipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    farmId,
    getEquipmentById, 
    getLogsForEquipment, 
    getIntervalsForEquipment,
    getFuelLogsForEquipment,
    deleteEquipment,
    updateEquipment,
    consumables,
    isLoading,
  } = useFarmData();
  const { currentScheme } = useTheme();

  const equipment = getEquipmentById(id ?? '');
  const logs = getLogsForEquipment(id ?? '');
  const intervals = getIntervalsForEquipment(id ?? '');
  const fuelLogs = getFuelLogsForEquipment(id ?? '');

  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [attachmentLabel, setAttachmentLabel] = useState('');
  const [pendingFile, setPendingFile] = useState<{ uri: string; name: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isQuickExporting, setIsQuickExporting] = useState(false);

  const handleQuickExport = async () => {
    if (!equipment) return;
    try {
      setIsQuickExporting(true);
      const allDates = logs.map((l) => l.date).concat(fuelLogs.map((l) => l.date));
      const dateRange = getDateRangeForPreset('alltime', allDates);
      const uri = await generateMaintenancePdf({
        equipment: [equipment],
        maintenanceLogs: logs,
        fuelLogs,
        consumables,
        colorScheme: currentScheme,
        dateRange,
        includeFuel: true,
        includeNotes: true,
        includeAttachments: true,
        isBatchSummary: false,
        farmId,
      });
      await shareFile(uri, 'application/pdf');
    } catch (error) {
      Alert.alert('Export Error', 'Failed to generate PDF. Please try again.');
      console.error('Quick export error:', error);
    } finally {
      setIsQuickExporting(false);
    }
  };

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

  const handlePickAttachment = async () => {
    try {
      // Wait for any modal animation to finish
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          setTimeout(() => resolve(), Platform.OS === 'ios' ? 300 : 100);
        });
      });

      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      setPendingFile({ uri: file.uri, name: file.name });
      setAttachmentLabel('');
      setShowAttachmentModal(true);
    } catch (error) {
      console.log('Error picking attachment:', error);
      Alert.alert('Error', 'Failed to pick file. Please try again.');
    }
  };

  const handleSaveAttachment = async () => {
    if (!pendingFile || !attachmentLabel.trim()) {
      Alert.alert('Label Required', 'Please enter a label for this file.');
      return;
    }

    setIsUploading(true);
    try {
      // Copy the file to the app's document directory for persistence
      const attachmentDir = `${FileSystem.documentDirectory}attachments/`;
      const dirInfo = await FileSystem.getInfoAsync(attachmentDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(attachmentDir, { intermediates: true });
      }

      const fileId = generateId();
      const fileExtension = pendingFile.name.split('.').pop() || 'pdf';
      const newFileName = `${fileId}.${fileExtension}`;
      const newUri = `${attachmentDir}${newFileName}`;

      await FileSystem.copyAsync({
        from: pendingFile.uri,
        to: newUri,
      });

      let remotePath: string | undefined;
      if (farmId && equipment) {
        remotePath = `${farmId}/equipment/${equipment.id}/${fileId}.${fileExtension}`;
        try {
          await uploadAttachment(newUri, remotePath, pendingFile.name);
        } catch (error) {
          console.log('Error uploading equipment attachment to Supabase, keeping local only:', error);
          remotePath = undefined;
        }
      }

      const newAttachment: EquipmentAttachment = {
        id: fileId,
        label: attachmentLabel.trim(),
        fileName: pendingFile.name,
        fileUri: newUri,
        remotePath,
        createdAt: new Date().toISOString(),
      };

      const existingAttachments = equipment?.attachments ?? [];
      await updateEquipment({
        id: id ?? '',
        attachments: [...existingAttachments, newAttachment],
      });

      setShowAttachmentModal(false);
      setPendingFile(null);
      setAttachmentLabel('');
    } catch (error) {
      console.log('Error saving attachment:', error);
      Alert.alert('Error', 'Failed to save the file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewAttachment = async (attachment: EquipmentAttachment) => {
    try {
      let localUri = attachment.fileUri;
      let fileInfo = await FileSystem.getInfoAsync(localUri);

      if (!fileInfo.exists && attachment.remotePath) {
        // Try to download from Supabase Storage if this device doesn't have a local copy yet
        try {
          const publicUrl = getAttachmentPublicUrl(attachment.remotePath);
          const cacheDir = `${FileSystem.cacheDirectory}attachments/`;
          const dirInfo = await FileSystem.getInfoAsync(cacheDir);
          if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
          }
          const fileExtension = attachment.fileName.split('.').pop() || 'file';
          const downloadUri = `${cacheDir}${attachment.id}.${fileExtension}`;
          const downloadResult = await FileSystem.downloadAsync(publicUrl, downloadUri);
          localUri = downloadResult.uri;
          fileInfo = await FileSystem.getInfoAsync(localUri);
        } catch (error) {
          console.log('Error downloading equipment attachment from Supabase:', error);
        }
      }

      if (!fileInfo.exists) {
        Alert.alert('File Not Found', 'This file may have been deleted. Please remove it and upload again.');
        return;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(localUri, {
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
              // Delete the file from disk
              const fileInfo = await FileSystem.getInfoAsync(attachment.fileUri);
              if (fileInfo.exists) {
                await FileSystem.deleteAsync(attachment.fileUri);
              }

              const updatedAttachments = (equipment?.attachments ?? []).filter(
                a => a.id !== attachment.id
              );
              await updateEquipment({
                id: id ?? '',
                attachments: updatedAttachments,
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

  const handleCopySerialNumber = async () => {
    if (!equipment?.serialNumber) return;
    try {
      await Clipboard.setStringAsync(equipment.serialNumber);
      Alert.alert('Copied', 'Serial number copied to clipboard.');
    } catch (error) {
      console.log('Error copying serial number:', error);
      Alert.alert('Error', 'Could not copy serial number.');
    }
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
                <Text style={styles.imageHoursText}>{formatMetric(equipment.currentHours, equipment.metric)}</Text>
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
              <Text style={styles.hoursText}>{formatMetric(equipment.currentHours, equipment.metric)}</Text>
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
            style={styles.actionButton}
            onPress={handleQuickExport}
            disabled={isQuickExporting}
          >
            {isQuickExporting ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Download color={Colors.primary} size={20} />
            )}
            <Text style={styles.actionButtonText}>Export</Text>
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
              {equipment.serialNumber ? (
                <TouchableOpacity
                  style={styles.copySerialButton}
                  onPress={handleCopySerialNumber}
                  accessibilityRole="button"
                  accessibilityLabel="Copy serial number"
                >
                  <Copy color={Colors.primary} size={14} />
                  <Text style={styles.copySerialButtonText}>Copy</Text>
                </TouchableOpacity>
              ) : null}
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
            {equipment.oilCapacity ? (
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Droplet color={Colors.textSecondary} size={16} />
                </View>
                <Text style={styles.detailLabel}>Oil Capacity</Text>
                <Text style={styles.detailValue}>{equipment.oilCapacity}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Documents</Text>
            <TouchableOpacity
              style={styles.addAttachmentButton}
              onPress={handlePickAttachment}
            >
              <Plus color={Colors.primary} size={18} />
              <Text style={styles.addAttachmentText}>Add File</Text>
            </TouchableOpacity>
          </View>
          {(!equipment.attachments || equipment.attachments.length === 0) ? (
            <View style={styles.emptyCard}>
              <Paperclip color={Colors.textSecondary} size={32} />
              <Text style={styles.emptyText}>No documents attached</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={handlePickAttachment}
              >
                <Text style={styles.emptyButtonText}>Upload a File</Text>
              </TouchableOpacity>
            </View>
          ) : (
            equipment.attachments.map(attachment => (
              <View key={attachment.id} style={styles.attachmentCard}>
                <View style={styles.attachmentIcon}>
                  <FileText color={Colors.primary} size={20} />
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
            ))
          )}
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Fuel History</Text>
            <TouchableOpacity
              style={styles.addAttachmentButton}
              onPress={() => router.push(`/maintenance/add-fuel?equipmentId=${equipment.id}` as any)}
            >
              <Plus color={Colors.primary} size={18} />
              <Text style={styles.addAttachmentText}>Log Fuel</Text>
            </TouchableOpacity>
          </View>
          {fuelLogs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Fuel color={Colors.textSecondary} size={32} />
              <Text style={styles.emptyText}>No fuel records yet</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push(`/maintenance/add-fuel?equipmentId=${equipment.id}` as any)}
              >
                <Text style={styles.emptyButtonText}>Log First Fill-Up</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.fuelSummaryCard}>
                <View style={styles.fuelSummaryRow}>
                  <View style={styles.fuelSummaryStat}>
                    <Text style={styles.fuelSummaryNumber}>
                      {fuelLogs.reduce((sum, fl) => sum + fl.gallons, 0).toFixed(1)}
                    </Text>
                    <Text style={styles.fuelSummaryLabel}>Total Gal</Text>
                  </View>
                  {fuelLogs.some(fl => fl.defGallons && fl.defGallons > 0) && (
                    <View style={styles.fuelSummaryStat}>
                      <Text style={styles.fuelSummaryNumber}>
                        {fuelLogs.reduce((sum, fl) => sum + (fl.defGallons ?? 0), 0).toFixed(1)}
                      </Text>
                      <Text style={styles.fuelSummaryLabel}>DEF Gal</Text>
                    </View>
                  )}
                  <View style={styles.fuelSummaryStat}>
                    <Text style={styles.fuelSummaryNumber}>{fuelLogs.length}</Text>
                    <Text style={styles.fuelSummaryLabel}>Fill-Ups</Text>
                  </View>
                </View>
              </View>
              {fuelLogs.slice(0, 5).map(fl => {
                const fuelTypeName = fl.fuelType === 'custom' && fl.customFuelTypeName
                  ? fl.customFuelTypeName
                  : fl.fuelType === 'off_road_diesel' ? 'Off-Road Diesel'
                  : fl.fuelType === 'on_road_diesel' ? 'On-Road Diesel'
                  : fl.fuelType === 'gasoline' ? 'Gasoline' : fl.fuelType;
                return (
                  <View key={fl.id} style={styles.logCard}>
                    <View style={styles.logHeader}>
                      <Text style={styles.logDate}>{formatDate(fl.date)}</Text>
                      <Text style={[styles.logType, { color: '#059669' }]}>{fuelTypeName}</Text>
                    </View>
                    <Text style={styles.logDescription}>
                      {fl.gallons} gal{fl.defGallons ? ` + ${fl.defGallons} gal DEF` : ''}
                    </Text>
                    <View style={styles.logMeta}>
                      <Text style={styles.logMetaText}>@ {formatMetric(fl.hoursAtFillUp, equipment.metric)}</Text>
                    </View>
                  </View>
                );
              })}
              {fuelLogs.length > 5 && (
                <Text style={styles.viewAllText}>
                  + {fuelLogs.length - 5} more fill-ups
                </Text>
              )}
            </>
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
              <TouchableOpacity
                key={log.id}
                style={styles.logCard}
                onPress={() => router.push(`/maintenance/${log.id}` as any)}
                activeOpacity={0.7}
              >
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
                  <Text style={styles.logMetaText}>@ {formatMetric(log.hoursAtService, equipment.metric)}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      <Modal
        visible={showAttachmentModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowAttachmentModal(false);
          setPendingFile(null);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setShowAttachmentModal(false);
            setPendingFile(null);
          }}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Label This File</Text>
            <Text style={styles.modalSubtitle}>
              {pendingFile?.name ?? 'Selected file'}
            </Text>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>File Label</Text>
              <TextInput
                style={styles.modalInput}
                value={attachmentLabel}
                onChangeText={setAttachmentLabel}
                placeholder={"e.g., Filters, Owner's Manual"}
                placeholderTextColor={Colors.textSecondary}
                autoFocus
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowAttachmentModal(false);
                  setPendingFile(null);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSaveButton,
                  (!attachmentLabel.trim() || isUploading) && styles.modalSaveButtonDisabled,
                ]}
                onPress={handleSaveAttachment}
                disabled={!attachmentLabel.trim() || isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator color={Colors.textOnPrimary} size="small" />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  copySerialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.primary + '15',
  },
  copySerialButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addAttachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addAttachmentText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  attachmentIcon: {
    width: 40,
    height: 40,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalInputGroup: {
    marginBottom: 20,
  },
  modalInputLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  modalSaveButtonDisabled: {
    opacity: 0.5,
  },
  modalSaveText: {
    fontSize: 16,
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
  fuelSummaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  fuelSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  fuelSummaryStat: {
    alignItems: 'center',
  },
  fuelSummaryNumber: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  fuelSummaryLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  viewAllText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500' as const,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
