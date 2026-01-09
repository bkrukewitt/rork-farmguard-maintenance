import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { 
  Wrench, 
  AlertCircle, 
  ClipboardCheck,
  Check,
  ChevronDown,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { MaintenanceLog, Consumable } from '@/types/equipment';

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
  const { equipment, addMaintenanceLog, updateInterval, getIntervalsForEquipment, consumables, deductConsumables } = useFarmData();

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

  const selectedEquipment = equipment.find(e => e.id === selectedEquipmentId);

  React.useEffect(() => {
    if (selectedEquipment) {
      setHoursAtService(selectedEquipment.currentHours.toString());
    }
  }, [selectedEquipment]);

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

      const log = await addMaintenanceLog({
        equipmentId: selectedEquipmentId,
        date,
        hoursAtService: parseFloat(hoursAtService) || 0,
        type,
        description: description.trim(),
        consumablesUsed,
        performedBy,
        notes: notes.trim(),
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

      return log;
    },
    onSuccess: () => {
      router.back();
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
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

          {showConsumablesPicker && (
            <View style={styles.pickerDropdown}>
              {consumables.length === 0 ? (
                <Text style={styles.noEquipmentText}>
                  No parts in inventory. Add parts in Inventory tab first.
                </Text>
              ) : (
                consumables.map((item: Consumable) => {
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
                })
              )}
            </View>
          )}

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
      </ScrollView>

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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
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
});
