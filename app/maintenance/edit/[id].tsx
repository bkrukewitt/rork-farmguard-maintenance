import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  InteractionManager,
  Modal,
  Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import KeyboardAwareScrollView from '@/components/KeyboardAwareScrollView';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  Wrench,
  AlertCircle,
  ClipboardCheck,
  Check,
  Paperclip,
  FileText,
  X,
  Eye,
  Trash2,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { MaintenanceLog, EquipmentAttachment, Consumable } from '@/types/equipment';
import { uploadAttachment, getAttachmentPublicUrl } from '@/utils/attachmentUpload';
import { generateId } from '@/utils/helpers';
import { useRateAppPrompt } from '@/hooks/useRateAppPrompt';
import { ChevronDown, Search } from 'lucide-react-native';

const SERVICE_TYPES: { value: MaintenanceLog['type']; label: string; Icon: React.ComponentType<{ color: string; size: number }> }[] = [
  { value: 'routine', label: 'Routine Service', Icon: Wrench },
  { value: 'repair', label: 'Repair', Icon: AlertCircle },
  { value: 'inspection', label: 'Inspection', Icon: ClipboardCheck },
];

const PERFORMER_OPTIONS: { value: MaintenanceLog['performedBy']; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'dealer', label: 'Dealer' },
  { value: 'employee', label: 'Employee' },
];

export default function EditMaintenanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    farmId,
    getMaintenanceLogById,
    getEquipmentById,
    updateMaintenanceLog,
    updateWorkOrder,
    deductConsumables,
    consumables,
    isLoading,
  } = useFarmData();
  const { maybeShowRatePrompt } = useRateAppPrompt();

  const log = getMaintenanceLogById(id ?? '');
  const equipment = log ? getEquipmentById(log.equipmentId) : undefined;
  const isDraftFromWorkOrder = !!(log?.isDraft && log?.workOrderId);

  const [type, setType] = useState<MaintenanceLog['type']>('routine');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [hoursAtService, setHoursAtService] = useState('');
  const [performedBy, setPerformedBy] = useState<MaintenanceLog['performedBy']>('owner');
  const [notes, setNotes] = useState('');
  const [existingAttachments, setExistingAttachments] = useState<EquipmentAttachment[]>([]);
  const [newAttachments, setNewAttachments] = useState<{ id: string; label: string; fileName: string; uri: string }[]>([]);
  const [showAttachmentLabelModal, setShowAttachmentLabelModal] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{ uri: string; name: string } | null>(null);
  const [attachmentLabel, setAttachmentLabel] = useState('');
  const [selectedConsumables, setSelectedConsumables] = useState<
    { consumableId: string; name: string; quantity: number }[]
  >([]);
  const [showConsumablesPicker, setShowConsumablesPicker] = useState(false);
  const [consumableSearch, setConsumableSearch] = useState('');

  // Initialize form from log data
  useEffect(() => {
    if (log) {
      setType(log.type);
      setDescription(log.description);
      setDate(log.date);
      setHoursAtService(log.hoursAtService.toString());
      setPerformedBy(log.performedBy);
      setNotes(log.notes ?? '');
      setExistingAttachments(log.attachments ?? []);
      setSelectedConsumables(log.consumablesUsed ?? []);
    }
  }, [log]);

  const filteredConsumables = useMemo(() => {
    const searchLower = consumableSearch.toLowerCase().trim();
    if (!searchLower) return consumables;
    return consumables.filter((item: Consumable) =>
      item.name.toLowerCase().includes(searchLower) ||
      item.partNumber.toLowerCase().includes(searchLower)
    );
  }, [consumables, consumableSearch]);

  const handlePickAttachment = async () => {
    try {
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => {
          setTimeout(() => resolve(), Platform.OS === 'ios' ? 300 : 100);
        });
      });

      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      setPendingAttachment({ uri: file.uri, name: file.name });
      setAttachmentLabel('');
      setShowAttachmentLabelModal(true);
    } catch (error) {
      console.log('Error picking attachment:', error);
      Alert.alert('Error', 'Failed to pick file. Please try again.');
    }
  };

  const handleConfirmAttachmentLabel = () => {
    if (!pendingAttachment || !attachmentLabel.trim()) return;

    setNewAttachments(prev => [
      ...prev,
      {
        id: generateId(),
        label: attachmentLabel.trim(),
        fileName: pendingAttachment.name,
        uri: pendingAttachment.uri,
      },
    ]);
    setShowAttachmentLabelModal(false);
    setPendingAttachment(null);
    setAttachmentLabel('');
  };

  const handleRemoveExistingAttachment = (attachmentId: string) => {
    Alert.alert(
      'Remove Attachment',
      'Are you sure you want to remove this attachment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const attachment = existingAttachments.find(a => a.id === attachmentId);
            if (attachment) {
              try {
                const fileInfo = await FileSystem.getInfoAsync(attachment.fileUri);
                if (fileInfo.exists) {
                  await FileSystem.deleteAsync(attachment.fileUri);
                }
              } catch (error) {
                console.log('Error deleting file:', error);
              }
            }
            setExistingAttachments(prev => prev.filter(a => a.id !== attachmentId));
          },
        },
      ]
    );
  };

  const handleRemoveNewAttachment = (attachmentId: string) => {
    setNewAttachments(prev => prev.filter(a => a.id !== attachmentId));
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
          console.log('Error downloading attachment from Supabase:', error);
        }
      }

      if (!fileInfo.exists) {
        Alert.alert('File Not Found', 'This file may have been deleted.');
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

  const saveNewAttachmentFiles = async (): Promise<EquipmentAttachment[]> => {
    const savedAttachments: EquipmentAttachment[] = [];

    for (const attachment of newAttachments) {
      try {
        const attachmentDir = `${FileSystem.documentDirectory}maintenance-attachments/`;
        const dirInfo = await FileSystem.getInfoAsync(attachmentDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(attachmentDir, { intermediates: true });
        }

        const fileExtension = attachment.fileName.split('.').pop() || 'file';
        const newFileName = `${attachment.id}.${fileExtension}`;
        const newUri = `${attachmentDir}${newFileName}`;

        await FileSystem.copyAsync({
          from: attachment.uri,
          to: newUri,
        });
        let remotePath: string | undefined;
        if (farmId && log) {
          remotePath = `${farmId}/maintenance/${log.id}/${attachment.id}.${fileExtension}`;
          try {
            await uploadAttachment(newUri, remotePath, attachment.fileName);
          } catch (error) {
            console.log('Error uploading attachment to Supabase, keeping local only:', error);
            remotePath = undefined;
          }
        }

        savedAttachments.push({
          id: attachment.id,
          label: attachment.label,
          fileName: attachment.fileName,
          fileUri: newUri,
          remotePath,
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        console.log('Error saving attachment:', error);
      }
    }

    return savedAttachments;
  };

  const saveMutation = useMutation({
    mutationFn: async (options?: { finishWork?: boolean }) => {
      if (!description.trim()) {
        throw new Error('Description is required');
      }
      if (!log) {
        throw new Error('Maintenance record not found');
      }

      const savedNewAttachments = newAttachments.length > 0
        ? await saveNewAttachmentFiles()
        : [];

      const allAttachments = [...existingAttachments, ...savedNewAttachments];
      const finishWork = options?.finishWork === true;

      await updateMaintenanceLog({
        id: id ?? '',
        type,
        description: description.trim(),
        date,
        hoursAtService: parseFloat(hoursAtService) || 0,
        performedBy,
        notes: notes.trim() || undefined,
        attachments: allAttachments.length > 0 ? allAttachments : undefined,
        consumablesUsed: selectedConsumables,
        isDraft: finishWork ? false : log.isDraft,
      });

      if (finishWork && log.workOrderId) {
        if (selectedConsumables.length > 0) {
          await deductConsumables(
            selectedConsumables.map(c => ({
              consumableId: c.consumableId,
              quantity: c.quantity,
            }))
          );
        }
        await updateWorkOrder({
          id: log.workOrderId,
          status: 'completed',
          completedAt: new Date().toISOString(),
        });
      }

      return { finishWork };
    },
    onSuccess: (result) => {
      if (result?.finishWork) {
        maybeShowRatePrompt();
        Alert.alert('Work complete', 'Saved to maintenance history and marked the work order complete.');
      }
      router.back();
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const handleSave = () => {
    saveMutation.mutate({});
  };

  const handleFinishWork = () => {
    Alert.alert(
      'Finish work?',
      'This saves the maintenance log and marks the work order complete. Parts used will be deducted from inventory.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Finish', onPress: () => saveMutation.mutate({ finishWork: true }) },
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

  return (
    <>
      <Stack.Screen options={{ title: isDraftFromWorkOrder ? 'Log Work in Progress' : 'Edit Service Record' }} />
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        stickyFooter={
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => router.back()}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            {isDraftFromWorkOrder ? (
              <>
                <TouchableOpacity
                  style={[styles.saveButton, styles.saveProgressButton, saveMutation.isPending && styles.saveButtonDisabled]}
                  onPress={handleSave}
                  disabled={saveMutation.isPending}
                >
                  <Check color={Colors.textOnPrimary} size={20} />
                  <Text style={styles.saveButtonText}>
                    {saveMutation.isPending ? 'Saving...' : 'Save Progress'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, styles.finishButton, saveMutation.isPending && styles.saveButtonDisabled]}
                  onPress={handleFinishWork}
                  disabled={saveMutation.isPending}
                >
                  <Check color={Colors.textOnPrimary} size={20} />
                  <Text style={styles.saveButtonText}>Finish Work</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.saveButton, saveMutation.isPending && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saveMutation.isPending}
              >
                <Check color={Colors.textOnPrimary} size={20} />
                <Text style={styles.saveButtonText}>
                  {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
      >
          {isDraftFromWorkOrder && (
            <View style={styles.draftBanner}>
              <Text style={styles.draftBannerTitle}>Work in progress</Text>
              <Text style={styles.draftBannerText}>
                Add notes, hours, and parts used. Save progress anytime, or Finish Work to complete the work order.
              </Text>
            </View>
          )}

          {/* Equipment (read-only) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Equipment</Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyText}>
                {equipment?.name ?? 'Unknown Equipment'}
              </Text>
              <Text style={styles.readOnlySubtext}>
                {equipment ? `${equipment.year} ${equipment.make} ${equipment.model}` : ''}
              </Text>
            </View>
          </View>

          {/* Service Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service Type</Text>
            <View style={styles.typeRow}>
              {SERVICE_TYPES.map(({ value, label, Icon }) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.typeButton,
                    type === value && styles.typeButtonActive,
                  ]}
                  onPress={() => setType(value)}
                >
                  <Icon
                    color={type === value ? Colors.textOnPrimary : Colors.textSecondary}
                    size={22}
                  />
                  <Text style={[
                    styles.typeLabel,
                    type === value && styles.typeLabelActive,
                  ]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Service Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service Details</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="e.g., Oil change, greased all fittings, checked belts"
                placeholderTextColor={Colors.textSecondary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Date</Text>
                <TextInput
                  style={styles.input}
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Hours at Service</Text>
                <TextInput
                  style={styles.input}
                  value={hoursAtService}
                  onChangeText={setHoursAtService}
                  placeholder="0"
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Performed By</Text>
              <View style={styles.performerRow}>
                {PERFORMER_OPTIONS.map(({ value, label }) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.performerButton,
                      performedBy === value && styles.performerButtonActive,
                    ]}
                    onPress={() => setPerformedBy(value)}
                  >
                    <Text style={[
                      styles.performerLabel,
                      performedBy === value && styles.performerLabelActive,
                    ]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Additional notes, parts used, issues found..."
                placeholderTextColor={Colors.textSecondary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Parts Used</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowConsumablesPicker(!showConsumablesPicker)}
            >
              <Text style={[
                styles.pickerButtonText,
                selectedConsumables.length === 0 && styles.pickerPlaceholder,
              ]}>
                {selectedConsumables.length > 0
                  ? `${selectedConsumables.length} part(s) selected`
                  : 'Select parts used...'}
              </Text>
              <ChevronDown color={Colors.textSecondary} size={20} />
            </TouchableOpacity>

            {showConsumablesPicker && (
              <View style={styles.pickerDropdown}>
                <View style={styles.consumablesSearchContainer}>
                  <Search color={Colors.textSecondary} size={18} />
                  <TextInput
                    style={styles.consumablesSearchInput}
                    value={consumableSearch}
                    onChangeText={setConsumableSearch}
                    placeholder="Search by part # or name..."
                    placeholderTextColor={Colors.textSecondary}
                  />
                </View>
                {filteredConsumables.length === 0 ? (
                  <Text style={styles.emptyPartsText}>No parts in inventory</Text>
                ) : (
                  filteredConsumables.slice(0, 40).map((item) => {
                    const selected = selectedConsumables.find(c => c.consumableId === item.id);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.pickerOption, selected && styles.pickerOptionActive]}
                        onPress={() => {
                          if (selected) {
                            setSelectedConsumables(prev =>
                              prev.filter(c => c.consumableId !== item.id)
                            );
                          } else {
                            setSelectedConsumables(prev => [
                              ...prev,
                              { consumableId: item.id, name: item.name, quantity: 1 },
                            ]);
                          }
                        }}
                      >
                        <Text style={styles.pickerOptionText}>{item.name}</Text>
                        <Text style={styles.pickerOptionSubtext}>
                          #{item.partNumber} • {item.quantity} in stock
                          {selected ? ` • qty ${selected.quantity}` : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            )}

            {selectedConsumables.map((item) => (
              <View key={item.consumableId} style={styles.selectedPartRow}>
                <Text style={styles.selectedPartName}>{item.name}</Text>
                <View style={styles.qtyControls}>
                  <TouchableOpacity
                    style={styles.qtyButton}
                    onPress={() => {
                      setSelectedConsumables(prev =>
                        prev
                          .map(c =>
                            c.consumableId === item.consumableId
                              ? { ...c, quantity: Math.max(1, c.quantity - 1) }
                              : c
                          )
                      );
                    }}
                  >
                    <Text style={styles.qtyButtonText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyButton}
                    onPress={() => {
                      setSelectedConsumables(prev =>
                        prev.map(c =>
                          c.consumableId === item.consumableId
                            ? { ...c, quantity: c.quantity + 1 }
                            : c
                        )
                      );
                    }}
                  >
                    <Text style={styles.qtyButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          {/* Attachments */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Attachments</Text>
            <TouchableOpacity
              style={styles.attachFileButton}
              onPress={handlePickAttachment}
            >
              <Paperclip color={Colors.primary} size={18} />
              <Text style={styles.attachFileText}>Attach a File</Text>
            </TouchableOpacity>

            {(existingAttachments.length > 0 || newAttachments.length > 0) && (
              <View style={styles.attachmentsList}>
                {existingAttachments.map((attachment) => (
                  <View key={attachment.id} style={styles.attachmentItem}>
                    <View style={styles.attachmentItemIcon}>
                      <FileText color={Colors.primary} size={18} />
                    </View>
                    <View style={styles.attachmentItemInfo}>
                      <Text style={styles.attachmentItemLabel}>{attachment.label}</Text>
                      <Text style={styles.attachmentItemFileName} numberOfLines={1}>
                        {attachment.fileName}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.attachmentActionButton}
                      onPress={() => handleViewAttachment(attachment)}
                    >
                      <Eye color={Colors.primary} size={16} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.attachmentActionButton}
                      onPress={() => handleRemoveExistingAttachment(attachment.id)}
                    >
                      <Trash2 color={Colors.statusOverdue} size={16} />
                    </TouchableOpacity>
                  </View>
                ))}

                {newAttachments.map((attachment) => (
                  <View key={attachment.id} style={styles.attachmentItem}>
                    <View style={styles.attachmentItemIcon}>
                      <FileText color={Colors.accent} size={18} />
                    </View>
                    <View style={styles.attachmentItemInfo}>
                      <Text style={styles.attachmentItemLabel}>{attachment.label}</Text>
                      <Text style={styles.attachmentItemFileName} numberOfLines={1}>
                        {attachment.fileName} (new)
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.attachmentActionButton}
                      onPress={() => handleRemoveNewAttachment(attachment.id)}
                    >
                      <X color={Colors.statusOverdue} size={16} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        <Modal
          visible={showAttachmentLabelModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowAttachmentLabelModal(false);
            setPendingAttachment(null);
          }}
        >
          <KeyboardAvoidingView
            style={styles.flexOne}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              setShowAttachmentLabelModal(false);
              setPendingAttachment(null);
            }}
          >
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>Label This File</Text>
              <Text style={styles.modalSubtitle} numberOfLines={2}>
                {pendingAttachment?.name ?? 'Selected file'}
              </Text>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalInputLabel}>File Label</Text>
                <TextInput
                  style={styles.modalInput}
                  value={attachmentLabel}
                  onChangeText={setAttachmentLabel}
                  placeholder={"e.g., Invoice, Work Order, Photo"}
                  placeholderTextColor={Colors.textSecondary}
                  autoFocus
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowAttachmentLabelModal(false);
                    setPendingAttachment(null);
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalSaveButton,
                    !attachmentLabel.trim() && styles.modalSaveButtonDisabled,
                  ]}
                  onPress={handleConfirmAttachmentLabel}
                  disabled={!attachmentLabel.trim()}
                >
                  <Text style={styles.modalSaveText}>Add</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
          </KeyboardAvoidingView>
        </Modal>
      </KeyboardAwareScrollView>
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
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  readOnlyField: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  readOnlyText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  readOnlySubtext: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  typeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  typeLabelActive: {
    color: Colors.textOnPrimary,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  performerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  performerButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  performerButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  performerLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  performerLabelActive: {
    color: Colors.textOnPrimary,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    paddingBottom: 32,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: 12,
  },
  cancelButton: {
    flexGrow: 1,
    minWidth: 90,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  saveButton: {
    flexGrow: 2,
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveProgressButton: {
    backgroundColor: Colors.primary,
  },
  finishButton: {
    backgroundColor: '#10B981',
    width: '100%',
    flexGrow: 0,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textOnPrimary,
  },
  draftBanner: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 14,
    marginBottom: 20,
  },
  draftBannerTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1D4ED8',
    marginBottom: 4,
  },
  draftBannerText: {
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pickerButtonText: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  pickerPlaceholder: {
    color: Colors.textSecondary,
  },
  pickerDropdown: {
    marginTop: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    overflow: 'hidden',
    maxHeight: 280,
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  pickerOptionActive: {
    backgroundColor: Colors.primary + '12',
  },
  pickerOptionText: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  pickerOptionSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  consumablesSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  consumablesSearchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 4,
  },
  emptyPartsText: {
    padding: 16,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  selectedPartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectedPartName: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  qtyValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    minWidth: 20,
    textAlign: 'center',
  },
  attachFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  attachFileText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  attachmentsList: {
    marginTop: 10,
    gap: 8,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  attachmentItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  attachmentItemInfo: {
    flex: 1,
  },
  attachmentItemLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  attachmentItemFileName: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  attachmentActionButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  flexOne: {
    flex: 1,
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
});
