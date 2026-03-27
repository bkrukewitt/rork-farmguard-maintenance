import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  InteractionManager,
  Modal,
  Pressable,
} from 'react-native';
import KeyboardAwareScrollView from '@/components/KeyboardAwareScrollView';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { 
  Wrench, 
  AlertCircle, 
  ClipboardCheck,
  Check,
  ChevronDown,
  Square,
  CheckSquare,
  ClipboardList,
  Paperclip,
  Plus,
  X,
  FileText,
  Search,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { usePurchases } from '@/contexts/PurchasesContext';
import Paywall from '@/components/Paywall';
import { MaintenanceLog, Consumable, ServiceRoutine, ChecklistItem, EquipmentAttachment, ConsumableCategory, CONSUMABLE_CATEGORIES } from '@/types/equipment';
import { uploadAttachment } from '@/utils/attachmentUpload';
import { generateId } from '@/utils/helpers';

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

export default function AddMaintenanceScreen() {
  const router = useRouter();
  const { equipmentId: preselectedEquipmentId } = useLocalSearchParams<{ equipmentId?: string }>();
  const { farmId, equipment, addMaintenanceLog, updateInterval, getIntervalsForEquipment, consumables, deductConsumables, serviceRoutines, updateEquipment, addConsumable } = useFarmData();
  const { isTrial, isSubscribed } = usePurchases();

  if (isTrial && !isSubscribed) {
    return <Paywall onDismiss={() => router.back()} />;
  }

  const [selectedEquipmentId, setSelectedEquipmentId] = useState(preselectedEquipmentId ?? '');
  const [showEquipmentPicker, setShowEquipmentPicker] = useState(false);
  const [type, setType] = useState<MaintenanceLog['type']>('routine');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [hoursAtService, setHoursAtService] = useState('');
  const [performedBy, setPerformedBy] = useState<MaintenanceLog['performedBy']>('owner');
  const [notes, setNotes] = useState('');
  const [showConsumablesPicker, setShowConsumablesPicker] = useState(false);
  const [selectedConsumables, setSelectedConsumables] = useState<{ consumableId: string; name: string; partNumber: string; quantity: number }[]>([]);
  const [showRoutinePicker, setShowRoutinePicker] = useState(false);
  const [selectedRoutine, setSelectedRoutine] = useState<ServiceRoutine | null>(null);
  const [checklistState, setChecklistState] = useState<ChecklistItem[]>([]);
  const [showAllConsumables, setShowAllConsumables] = useState(false);
  const [attachments, setAttachments] = useState<{ id: string; label: string; fileName: string; uri: string }[]>([]);
  const [showAttachmentLabelModal, setShowAttachmentLabelModal] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{ uri: string; name: string } | null>(null);
  const [attachmentLabel, setAttachmentLabel] = useState('');
  const [consumableSearch, setConsumableSearch] = useState('');
  const [showAddConsumableModal, setShowAddConsumableModal] = useState(false);
  const [newConsumableName, setNewConsumableName] = useState('');
  const [newConsumablePartNumber, setNewConsumablePartNumber] = useState('');
  const [newConsumableCategory, setNewConsumableCategory] = useState<ConsumableCategory>('other');
  const [newConsumableQuantity, setNewConsumableQuantity] = useState('1');

  const selectedEquipment = equipment.find(e => e.id === selectedEquipmentId);

  React.useEffect(() => {
    if (selectedEquipment) {
      setHoursAtService(selectedEquipment.currentHours.toString());
    }
    setShowAllConsumables(false);
    setConsumableSearch('');
  }, [selectedEquipment]);

  const filteredConsumables = useMemo(() => {
    const searchLower = consumableSearch.toLowerCase().trim();
    if (!searchLower) return consumables;
    return consumables.filter((item: Consumable) =>
      item.partNumber.toLowerCase().includes(searchLower) ||
      item.name.toLowerCase().includes(searchLower)
    );
  }, [consumables, consumableSearch]);

  const handleAddNewConsumable = async () => {
    if (!newConsumableName.trim() || !newConsumablePartNumber.trim()) {
      Alert.alert('Error', 'Please enter both name and part number');
      return;
    }

    try {
      const newConsumable = await addConsumable({
        name: newConsumableName.trim(),
        partNumber: newConsumablePartNumber.trim(),
        category: newConsumableCategory,
        quantity: parseInt(newConsumableQuantity) || 1,
        lowStockThreshold: 1,
        compatibleEquipment: selectedEquipmentId ? [selectedEquipmentId] : [],
      });

      setSelectedConsumables(prev => [
        ...prev,
        {
          consumableId: newConsumable.id,
          name: newConsumable.name,
          partNumber: newConsumable.partNumber,
          quantity: 1,
        },
      ]);

      setShowAddConsumableModal(false);
      setNewConsumableName('');
      setNewConsumablePartNumber('');
      setNewConsumableCategory('other');
      setNewConsumableQuantity('1');
    } catch (error) {
      console.log('Error adding consumable:', error);
      Alert.alert('Error', 'Failed to add part');
    }
  };

  const handleSelectRoutine = (routine: ServiceRoutine | null) => {
    setSelectedRoutine(routine);
    if (routine) {
      setChecklistState(
        routine.checklistItems.map(item => ({
          id: item.id,
          text: item.text,
          completed: false,
        }))
      );
      if (!description.trim()) {
        setDescription(routine.name);
      }
    } else {
      setChecklistState([]);
    }
    setShowRoutinePicker(false);
  };

  const toggleChecklistItem = (itemId: string) => {
    setChecklistState(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const completedCount = checklistState.filter(item => item.completed).length;

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

    setAttachments(prev => [
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

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments(prev => prev.filter(a => a.id !== attachmentId));
  };

  const saveAttachmentFiles = async (logId: string): Promise<EquipmentAttachment[]> => {
    const savedAttachments: EquipmentAttachment[] = [];

    for (const attachment of attachments) {
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

        // Upload to Supabase Storage so attachments are shared across farm devices
        if (farmId) {
          const remotePath = `${farmId}/maintenance/${logId}/${attachment.id}.${fileExtension}`;
          try {
            await uploadAttachment(newUri, remotePath, attachment.fileName);
            savedAttachments.push({
              id: attachment.id,
              label: attachment.label,
              fileName: attachment.fileName,
              fileUri: newUri,
              remotePath,
              createdAt: new Date().toISOString(),
            });
            continue;
          } catch (error) {
            console.log('Error uploading attachment to Supabase, keeping local only:', error);
          }
        }

        savedAttachments.push({
          id: attachment.id,
          label: attachment.label,
          fileName: attachment.fileName,
          fileUri: newUri,
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        console.log('Error saving attachment:', error);
      }
    }

    return savedAttachments;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEquipmentId) {
        throw new Error('Please select equipment');
      }
      if (!description.trim()) {
        throw new Error('Description is required');
      }

      const consumablesUsed = selectedConsumables.map(c => ({
        consumableId: c.consumableId,
        name: c.name,
        quantity: c.quantity,
      }));

      // Save attachment files to persistent storage
      const savedAttachments = attachments.length > 0
        ? await saveAttachmentFiles(selectedEquipmentId)
        : undefined;

      const log = await addMaintenanceLog({
        equipmentId: selectedEquipmentId,
        date,
        hoursAtService: parseFloat(hoursAtService) || 0,
        type,
        description: description.trim(),
        consumablesUsed,
        performedBy,
        notes: notes.trim(),
        attachments: savedAttachments,
      });

      if (selectedConsumables.length > 0) {
        await deductConsumables(
          selectedConsumables.map(c => ({
            consumableId: c.consumableId,
            quantity: c.quantity,
          }))
        );
      }

      const intervals = getIntervalsForEquipment(selectedEquipmentId);
      const descLower = description.toLowerCase();
      
      for (const interval of intervals) {
        const intervalNameLower = interval.name.toLowerCase();
        if (descLower.includes(intervalNameLower) || intervalNameLower.includes(descLower.split(' ')[0])) {
          await updateInterval({
            id: interval.id,
            lastPerformedHours: parseFloat(hoursAtService) || 0,
            lastPerformedDate: date,
          });
        }
      }

      return { log, equipmentId: selectedEquipmentId, serviceHours: parseFloat(hoursAtService) || 0 };
    },
    onSuccess: (result) => {
      const equip = equipment.find(e => e.id === result.equipmentId);
      const serviceHours = result.serviceHours;
      
      if (equip && serviceHours > 0 && serviceHours !== equip.currentHours) {
        Alert.alert(
          'Update Equipment Hours?',
          `The service was logged at ${serviceHours.toLocaleString()} hours.\n\nWould you like to update "${equip.name}" from ${equip.currentHours.toLocaleString()} hours to ${serviceHours.toLocaleString()} hours?`,
          [
            {
              text: 'No',
              style: 'cancel',
              onPress: () => router.back(),
            },
            {
              text: 'Yes, Update',
              onPress: async () => {
                try {
                  await updateEquipment({
                    id: result.equipmentId,
                    currentHours: serviceHours,
                  });
                  router.back();
                } catch (error) {
                  console.log('Error updating equipment hours:', error);
                  router.back();
                }
              },
            },
          ]
        );
      } else {
        router.back();
      }
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  return (
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
          <TouchableOpacity
            style={[styles.saveButton, saveMutation.isPending && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saveMutation.isPending}
          >
            <Check color={Colors.textOnPrimary} size={20} />
            <Text style={styles.saveButtonText}>
              {saveMutation.isPending ? 'Saving...' : 'Save Log'}
            </Text>
          </TouchableOpacity>
        </View>
      }
    >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Equipment</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowEquipmentPicker(!showEquipmentPicker)}
          >
            <Text style={[
              styles.pickerText,
              !selectedEquipment && styles.pickerPlaceholder
            ]}>
              {selectedEquipment?.name ?? 'Select equipment...'}
            </Text>
            <ChevronDown color={Colors.textSecondary} size={20} />
          </TouchableOpacity>
          
          {showEquipmentPicker && (
            <View style={styles.pickerDropdown}>
              {equipment.map(eq => (
                <TouchableOpacity
                  key={eq.id}
                  style={[
                    styles.pickerOption,
                    selectedEquipmentId === eq.id && styles.pickerOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedEquipmentId(eq.id);
                    setShowEquipmentPicker(false);
                  }}
                >
                  <Text style={[
                    styles.pickerOptionText,
                    selectedEquipmentId === eq.id && styles.pickerOptionTextActive,
                  ]}>
                    {eq.name}
                  </Text>
                  <Text style={styles.pickerOptionSubtext}>
                    {eq.make} {eq.model}
                  </Text>
                </TouchableOpacity>
              ))}
              {equipment.length === 0 && (
                <Text style={styles.noEquipmentText}>
                  No equipment added yet. Add equipment first.
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Routine (Optional)</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowRoutinePicker(!showRoutinePicker)}
          >
            <View style={styles.routinePickerContent}>
              <ClipboardList color={selectedRoutine ? Colors.primary : Colors.textSecondary} size={18} />
              <Text style={[
                styles.pickerText,
                !selectedRoutine && styles.pickerPlaceholder
              ]}>
                {selectedRoutine?.name ?? 'Select a service routine...'}
              </Text>
            </View>
            <ChevronDown color={Colors.textSecondary} size={20} />
          </TouchableOpacity>
          
          {showRoutinePicker && (
            <View style={styles.pickerDropdown}>
              <TouchableOpacity
                style={styles.pickerOption}
                onPress={() => handleSelectRoutine(null)}
              >
                <Text style={styles.pickerOptionText}>No routine</Text>
              </TouchableOpacity>
              {serviceRoutines.length === 0 ? (
                <Text style={styles.noEquipmentText}>
                  No service routines created yet. Create one in Settings → Service Routines.
                </Text>
              ) : (
                serviceRoutines.map((routine: ServiceRoutine) => (
                  <TouchableOpacity
                    key={routine.id}
                    style={[
                      styles.pickerOption,
                      selectedRoutine?.id === routine.id && styles.pickerOptionActive,
                    ]}
                    onPress={() => handleSelectRoutine(routine)}
                  >
                    <Text style={[
                      styles.pickerOptionText,
                      selectedRoutine?.id === routine.id && styles.pickerOptionTextActive,
                    ]}>
                      {routine.name}
                    </Text>
                    <Text style={styles.pickerOptionSubtext}>
                      {routine.checklistItems.length} checklist items
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {selectedRoutine && checklistState.length > 0 && (
            <View style={styles.checklistContainer}>
              <View style={styles.checklistHeader}>
                <Text style={styles.checklistTitle}>Checklist</Text>
                <Text style={styles.checklistProgress}>
                  {completedCount}/{checklistState.length} completed
                </Text>
              </View>
              {checklistState.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.checklistItemRow}
                  onPress={() => toggleChecklistItem(item.id)}
                  activeOpacity={0.7}
                >
                  {item.completed ? (
                    <CheckSquare color={Colors.success} size={22} />
                  ) : (
                    <Square color={Colors.textSecondary} size={22} />
                  )}
                  <Text style={[
                    styles.checklistItemText,
                    item.completed && styles.checklistItemTextCompleted,
                  ]}>
                    {item.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

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
          <Text style={styles.sectionTitle}>Parts & Consumables Used</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowConsumablesPicker(!showConsumablesPicker)}
          >
            <Text style={[
              styles.pickerText,
              selectedConsumables.length === 0 && styles.pickerPlaceholder
            ]}>
              {selectedConsumables.length > 0
                ? `${selectedConsumables.length} part(s) selected`
                : 'Select parts used...'}
            </Text>
            <ChevronDown color={Colors.textSecondary} size={20} />
          </TouchableOpacity>

          {showConsumablesPicker && (() => {
            const partsToFilter = filteredConsumables;
            const compatibleParts = selectedEquipmentId
              ? partsToFilter.filter((item: Consumable) =>
                  item.compatibleEquipment?.includes(selectedEquipmentId)
                )
              : [];
            const otherParts = selectedEquipmentId
              ? partsToFilter.filter((item: Consumable) =>
                  !item.compatibleEquipment?.includes(selectedEquipmentId)
                )
              : partsToFilter;
            const hasCompatible = compatibleParts.length > 0;
            const hasOther = otherParts.length > 0;
            const hasSearchResults = partsToFilter.length > 0;
            const isEquipmentSelected = !!selectedEquipmentId;

            const renderConsumableItem = (item: Consumable) => {
              const selected = selectedConsumables.find(c => c.consumableId === item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.pickerOption,
                    selected && styles.pickerOptionActive,
                  ]}
                  onPress={() => {
                    if (selected) {
                      setSelectedConsumables(prev =>
                        prev.filter(c => c.consumableId !== item.id)
                      );
                    } else {
                      setSelectedConsumables(prev => [
                        ...prev,
                        {
                          consumableId: item.id,
                          name: item.name,
                          partNumber: item.partNumber,
                          quantity: 1,
                        },
                      ]);
                    }
                  }}
                >
                  <View style={styles.consumableRow}>
                    <View style={[
                      styles.checkbox,
                      selected && styles.checkboxActive,
                    ]}>
                      {selected && <Check color={Colors.textOnPrimary} size={14} />}
                    </View>
                    <View style={styles.consumableInfo}>
                      <Text style={styles.pickerOptionText}>{item.name}</Text>
                      <Text style={styles.pickerOptionSubtext}>
                        #{item.partNumber} • {item.quantity} in stock
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            };

            return (
              <View style={styles.pickerDropdown}>
                <View style={styles.consumablesSearchContainer}>
                  <Search color={Colors.textSecondary} size={18} />
                  <TextInput
                    style={styles.consumablesSearchInput}
                    value={consumableSearch}
                    onChangeText={setConsumableSearch}
                    placeholder="Search by part # or name..."
                    placeholderTextColor={Colors.textSecondary}
                    autoCapitalize="none"
                  />
                  {consumableSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setConsumableSearch('')}>
                      <X color={Colors.textSecondary} size={18} />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.addNewPartButton}
                  onPress={() => {
                    setShowConsumablesPicker(false);
                    setShowAddConsumableModal(true);
                  }}
                >
                  <Plus color={Colors.primary} size={18} />
                  <Text style={styles.addNewPartText}>Add New Part</Text>
                </TouchableOpacity>

                {consumables.length === 0 ? (
                  <Text style={styles.noEquipmentText}>
                    No parts in inventory. Add a new part above.
                  </Text>
                ) : !hasSearchResults && consumableSearch.length > 0 ? (
                  <Text style={styles.noEquipmentText}>
                    No parts found matching "{consumableSearch}"
                  </Text>
                ) : isEquipmentSelected ? (
                  <>
                    <View style={styles.consumablesSectionHeader}>
                      <Text style={styles.consumablesSectionLabel}>
                        Parts for {selectedEquipment?.name ?? 'Selected Equipment'}
                      </Text>
                    </View>
                    {hasCompatible ? (
                      compatibleParts.map(renderConsumableItem)
                    ) : (
                      <View style={styles.noCompatiblePartsContainer}>
                        <Text style={styles.noCompatiblePartsText}>
                          No parts linked to this equipment yet
                        </Text>
                      </View>
                    )}

                    {hasOther && (
                      <TouchableOpacity
                        style={styles.showAllPartsButton}
                        onPress={() => setShowAllConsumables(!showAllConsumables)}
                      >
                        <Text style={styles.showAllPartsText}>
                          {showAllConsumables
                            ? 'Hide All Parts'
                            : `Show All Parts (${otherParts.length})`}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {showAllConsumables && hasOther && (
                      <>
                        <View style={styles.consumablesSectionHeader}>
                          <Text style={styles.consumablesSectionLabel}>All Other Parts</Text>
                        </View>
                        {otherParts.map(renderConsumableItem)}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {partsToFilter.map(renderConsumableItem)}
                  </>
                )}
              </View>
            );
          })()}

          {selectedConsumables.length > 0 && (
            <View style={styles.selectedPartsContainer}>
              <Text style={styles.selectedPartsTitle}>Selected Parts:</Text>
              {selectedConsumables.map((item) => (
                <View key={item.consumableId} style={styles.selectedPartRow}>
                  <View style={styles.selectedPartInfo}>
                    <Text style={styles.selectedPartName}>{item.name}</Text>
                    <Text style={styles.selectedPartNumber}>#{item.partNumber}</Text>
                  </View>
                  <View style={styles.quantityControl}>
                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() => {
                        if (item.quantity > 1) {
                          setSelectedConsumables(prev =>
                            prev.map(c =>
                              c.consumableId === item.consumableId
                                ? { ...c, quantity: c.quantity - 1 }
                                : c
                            )
                          );
                        }
                      }}
                    >
                      <Text style={styles.qtyButtonText}>−</Text>
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
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attachments</Text>
          <TouchableOpacity
            style={styles.attachFileButton}
            onPress={handlePickAttachment}
          >
            <Paperclip color={Colors.primary} size={18} />
            <Text style={styles.attachFileText}>Attach a File</Text>
          </TouchableOpacity>

          {attachments.length > 0 && (
            <View style={styles.attachmentsList}>
              {attachments.map((attachment) => (
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
                    style={styles.attachmentRemoveButton}
                    onPress={() => handleRemoveAttachment(attachment.id)}
                  >
                    <X color={Colors.statusOverdue} size={18} />
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
      </Modal>

      <Modal
        visible={showAddConsumableModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddConsumableModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowAddConsumableModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Add New Part</Text>
            <Text style={styles.modalSubtitle}>
              {selectedEquipment ? `Will be linked to ${selectedEquipment.name}` : 'Select equipment first to link'}
            </Text>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Part Name *</Text>
              <TextInput
                style={styles.modalInput}
                value={newConsumableName}
                onChangeText={setNewConsumableName}
                placeholder="e.g., Oil Filter"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Part Number *</Text>
              <TextInput
                style={styles.modalInput}
                value={newConsumablePartNumber}
                onChangeText={setNewConsumablePartNumber}
                placeholder="e.g., RE504836"
                placeholderTextColor={Colors.textSecondary}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                <View style={styles.categoryRow}>
                  {CONSUMABLE_CATEGORIES.map(cat => (
                    <TouchableOpacity
                      key={cat.value}
                      style={[
                        styles.categoryChip,
                        newConsumableCategory === cat.value && styles.categoryChipActive,
                      ]}
                      onPress={() => setNewConsumableCategory(cat.value)}
                    >
                      <Text style={[
                        styles.categoryChipText,
                        newConsumableCategory === cat.value && styles.categoryChipTextActive,
                      ]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Quantity in Stock</Text>
              <TextInput
                style={styles.modalInput}
                value={newConsumableQuantity}
                onChangeText={setNewConsumableQuantity}
                placeholder="1"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowAddConsumableModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalSaveButton,
                  (!newConsumableName.trim() || !newConsumablePartNumber.trim()) && styles.modalSaveButtonDisabled,
                ]}
                onPress={handleAddNewConsumable}
                disabled={!newConsumableName.trim() || !newConsumablePartNumber.trim()}
              >
                <Text style={styles.modalSaveText}>Add Part</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
  picker: {
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
  pickerText: {
    fontSize: 16,
    color: Colors.text,
  },
  pickerPlaceholder: {
    color: Colors.textSecondary,
  },
  pickerDropdown: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  pickerOptionActive: {
    backgroundColor: Colors.primary + '10',
  },
  pickerOptionText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  pickerOptionTextActive: {
    color: Colors.primary,
  },
  pickerOptionSubtext: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  noEquipmentText: {
    padding: 20,
    textAlign: 'center',
    color: Colors.textSecondary,
  },
  routinePickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checklistContainer: {
    marginTop: 12,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 12,
    padding: 14,
  },
  checklistHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  checklistTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  checklistProgress: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  checklistItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  checklistItemText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  checklistItemTextCompleted: {
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  consumableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  consumableInfo: {
    flex: 1,
  },
  consumablesSectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  consumablesSectionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  showAllPartsButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.primary + '08',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    alignItems: 'center',
  },
  showAllPartsText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  consumablesSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 10,
  },
  consumablesSearchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    padding: 0,
  },
  addNewPartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.primary + '10',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 8,
  },
  addNewPartText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  categoryScroll: {
    marginHorizontal: -4,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryChipText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  categoryChipTextActive: {
    color: Colors.textOnPrimary,
  },
  selectedPartsContainer: {
    marginTop: 12,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    padding: 12,
  },
  selectedPartsTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  selectedPartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  selectedPartInfo: {
    flex: 1,
  },
  selectedPartName: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  selectedPartNumber: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyButtonText: {
    color: Colors.textOnPrimary,
    fontSize: 18,
    fontWeight: '600' as const,
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    minWidth: 24,
    textAlign: 'center',
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
    padding: 16,
    paddingBottom: 32,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
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
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textOnPrimary,
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
  attachmentRemoveButton: {
    width: 32,
    height: 32,
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
  noCompatiblePartsContainer: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  noCompatiblePartsText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
