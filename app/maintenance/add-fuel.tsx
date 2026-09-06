import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import KeyboardAwareScrollView from '@/components/KeyboardAwareScrollView';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Fuel,
  ChevronDown,
  Check,
  Plus,
  X,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { usePurchases } from '@/contexts/PurchasesContext';
import Paywall from '@/components/Paywall';
import { FuelType, BUILT_IN_FUEL_TYPES, FUEL_FILLER_OPTIONS } from '@/types/equipment';

export default function AddFuelLogScreen() {
  const router = useRouter();
  const { equipmentId: preselectedEquipmentId } = useLocalSearchParams<{ equipmentId?: string }>();
  const {
    equipment,
    addFuelLog,
    updateEquipment,
    customFuelTypes,
    addCustomFuelType,
    isDemoMode,
  } = useFarmData();
  const { isTrial, isSubscribed } = usePurchases();

  const [selectedEquipmentId, setSelectedEquipmentId] = useState(preselectedEquipmentId ?? '');
  const [showEquipmentPicker, setShowEquipmentPicker] = useState(false);
  const [fuelType, setFuelType] = useState<FuelType>('off_road_diesel');
  const [customFuelTypeName, setCustomFuelTypeName] = useState('');
  const [gallons, setGallons] = useState('');
  const [defGallons, setDefGallons] = useState('');
  const [showDefInput, setShowDefInput] = useState(false);
  const [hoursAtFillUp, setHoursAtFillUp] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [filledBy, setFilledBy] = useState<'owner' | 'dealer' | 'employee'>('owner');
  const [filledByName, setFilledByName] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showAddCustomFuelModal, setShowAddCustomFuelModal] = useState(false);
  const [newCustomFuelInput, setNewCustomFuelInput] = useState('');

  const selectedEquipment = useMemo(
    () => equipment.find(e => e.id === selectedEquipmentId),
    [equipment, selectedEquipmentId]
  );

  const allFuelTypes = useMemo(() => {
    const built = BUILT_IN_FUEL_TYPES.map(ft => ({ value: ft.value, label: ft.label }));
    const custom = customFuelTypes.map(ct => ({ value: 'custom' as FuelType, label: ct.name }));
    return [...built, ...custom];
  }, [customFuelTypes]);

  if (!isSubscribed && !isTrial && !isDemoMode) {
    return <Paywall onDismiss={() => router.back()} />;
  }

  const handleSave = async () => {
    if (!selectedEquipmentId) {
      Alert.alert('Required', 'Please select equipment.');
      return;
    }
    if (!gallons || parseFloat(gallons) <= 0) {
      Alert.alert('Required', 'Please enter gallons.');
      return;
    }
    if (!hoursAtFillUp) {
      Alert.alert('Required', 'Please enter hours/miles at fill-up.');
      return;
    }

    setIsSaving(true);
    try {
      const resolvedCustomName = fuelType === 'custom' ? customFuelTypeName : undefined;

      await addFuelLog({
        equipmentId: selectedEquipmentId,
        date,
        fuelType,
        customFuelTypeName: resolvedCustomName,
        gallons: parseFloat(gallons),
        defGallons: showDefInput && defGallons ? parseFloat(defGallons) : undefined,
        hoursAtFillUp: parseFloat(hoursAtFillUp),
        filledBy,
        filledByName: filledBy === 'employee' ? filledByName.trim() || undefined : undefined,
        notes: notes.trim() || undefined,
      });

      const equip = selectedEquipment;
      const newHours = parseFloat(hoursAtFillUp);
      if (equip && newHours > equip.currentHours) {
        Alert.alert(
          'Update Equipment Hours?',
          `The current reading for ${equip.name} is ${equip.currentHours.toLocaleString()}. Update to ${newHours.toLocaleString()}?`,
          [
            { text: 'No', style: 'cancel', onPress: () => router.back() },
            {
              text: 'Yes',
              onPress: async () => {
                try {
                  await updateEquipment({ id: equip.id, currentHours: newHours });
                } catch (err) {
                  console.log('Error updating equipment hours:', err);
                }
                router.back();
              },
            },
          ]
        );
      } else {
        router.back();
      }
    } catch (error) {
      console.log('Error saving fuel log:', error);
      Alert.alert('Error', 'Failed to save fuel log. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCustomFuel = async () => {
    const trimmed = newCustomFuelInput.trim();
    if (!trimmed) return;
    try {
      await addCustomFuelType(trimmed);
      setFuelType('custom');
      setCustomFuelTypeName(trimmed);
      setNewCustomFuelInput('');
      setShowAddCustomFuelModal(false);
    } catch (error) {
      console.log('Error adding custom fuel type:', error);
      Alert.alert('Error', 'Failed to add custom fuel type.');
    }
  };

  return (
    <KeyboardAwareScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.headerCard}>
        <View style={styles.headerIcon}>
          <Fuel color="#059669" size={32} />
        </View>
        <Text style={styles.headerTitle}>Log Fuel Fill-Up</Text>
        <Text style={styles.headerSubtitle}>Record fuel and DEF usage for your equipment</Text>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.label}>Equipment *</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowEquipmentPicker(true)}
        >
          <Text style={[styles.pickerText, !selectedEquipment && styles.placeholderText]}>
            {selectedEquipment?.name ?? 'Select Equipment'}
          </Text>
          <ChevronDown color={Colors.textSecondary} size={18} />
        </TouchableOpacity>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.label}>Date *</Text>
        <TextInput
          style={styles.input}
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={Colors.textSecondary}
        />
      </View>

      <View style={styles.formSection}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Fuel Type *</Text>
          <TouchableOpacity
            style={styles.addCustomBtn}
            onPress={() => { setNewCustomFuelInput(''); setShowAddCustomFuelModal(true); }}
          >
            <Plus color={Colors.primary} size={14} />
            <Text style={styles.addCustomBtnText}>Custom</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.chipRow}>
          {allFuelTypes.map((ft) => {
            const isSelected = fuelType === ft.value && (ft.value !== 'custom' || customFuelTypeName === ft.label);
            return (
              <TouchableOpacity
                key={ft.label}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => {
                  setFuelType(ft.value);
                  if (ft.value === 'custom') {
                    setCustomFuelTypeName(ft.label);
                  } else {
                    setCustomFuelTypeName('');
                  }
                }}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {ft.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.label}>Gallons *</Text>
        <TextInput
          style={styles.input}
          value={gallons}
          onChangeText={setGallons}
          placeholder="e.g., 50"
          placeholderTextColor={Colors.textSecondary}
          keyboardType="decimal-pad"
        />
      </View>

      <View style={styles.formSection}>
        <TouchableOpacity
          style={styles.defToggle}
          onPress={() => setShowDefInput(!showDefInput)}
        >
          <View style={[styles.defCheckbox, showDefInput && styles.defCheckboxActive]}>
            {showDefInput && <Check color="#fff" size={14} />}
          </View>
          <Text style={styles.defToggleText}>Also added DEF (Diesel Exhaust Fluid)</Text>
        </TouchableOpacity>
        {showDefInput && (
          <TextInput
            style={[styles.input, { marginTop: 10 }]}
            value={defGallons}
            onChangeText={setDefGallons}
            placeholder="DEF gallons"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="decimal-pad"
          />
        )}
      </View>

      <View style={styles.formSection}>
        <Text style={styles.label}>
          {selectedEquipment?.metric === 'miles' ? 'Miles' : 'Hours'} at Fill-Up *
        </Text>
        <TextInput
          style={styles.input}
          value={hoursAtFillUp}
          onChangeText={setHoursAtFillUp}
          placeholder={selectedEquipment?.metric === 'miles' ? 'Current miles' : 'Current hours'}
          placeholderTextColor={Colors.textSecondary}
          keyboardType="decimal-pad"
        />
        {selectedEquipment && (
          <Text style={styles.helperText}>
            Current: {selectedEquipment.currentHours.toLocaleString()} {selectedEquipment.metric === 'miles' ? 'mi' : 'hrs'}
          </Text>
        )}
      </View>

      <View style={styles.formSection}>
        <Text style={styles.label}>Filled By</Text>
        <View style={styles.chipRow}>
          {FUEL_FILLER_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, filledBy === opt.value && styles.chipSelected]}
              onPress={() => setFilledBy(opt.value)}
            >
              <Text style={[styles.chipText, filledBy === opt.value && styles.chipTextSelected]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {filledBy === 'employee' && (
          <TextInput
            style={[styles.input, { marginTop: 10 }]}
            value={filledByName}
            onChangeText={setFilledByName}
            placeholder="Employee name"
            placeholderTextColor={Colors.textSecondary}
          />
        )}
      </View>

      <View style={styles.formSection}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional notes..."
          placeholderTextColor={Colors.textSecondary}
          multiline
          textAlignVertical="top"
        />
      </View>

      <TouchableOpacity
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={isSaving}
      >
        <Fuel color="#fff" size={20} />
        <Text style={styles.saveButtonText}>
          {isSaving ? 'Saving...' : 'Log Fill-Up'}
        </Text>
      </TouchableOpacity>

      <View style={styles.bottomPadding} />

      <Modal
        visible={showEquipmentPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEquipmentPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowEquipmentPicker(false)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Equipment</Text>
              <TouchableOpacity onPress={() => setShowEquipmentPicker(false)}>
                <X color={Colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={equipment}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.equipmentRow, selectedEquipmentId === item.id && styles.equipmentRowSelected]}
                  onPress={() => {
                    setSelectedEquipmentId(item.id);
                    setHoursAtFillUp(item.currentHours > 0 ? item.currentHours.toString() : '');
                    setShowEquipmentPicker(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.equipmentRowName}>{item.name}</Text>
                    <Text style={styles.equipmentRowSub}>
                      {item.year} {item.make} {item.model}
                    </Text>
                  </View>
                  {selectedEquipmentId === item.id && <Check color={Colors.primary} size={20} />}
                </TouchableOpacity>
              )}
              style={{ maxHeight: 400 }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No equipment found. Add equipment first.</Text>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showAddCustomFuelModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddCustomFuelModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.flexOne}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <Pressable style={styles.modalOverlayCentered} onPress={() => setShowAddCustomFuelModal(false)}>
          <Pressable style={styles.modalContentCentered} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Add Custom Fuel Type</Text>
            <TextInput
              style={[styles.input, { marginTop: 16, marginBottom: 16 }]}
              value={newCustomFuelInput}
              onChangeText={setNewCustomFuelInput}
              placeholder="e.g., Propane, E85"
              placeholderTextColor={Colors.textSecondary}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowAddCustomFuelModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, !newCustomFuelInput.trim() && { opacity: 0.5 }]}
                onPress={handleAddCustomFuel}
                disabled={!newCustomFuelInput.trim()}
              >
                <Text style={styles.modalSaveText}>Add</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerCard: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 8,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#05966915',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  formSection: {
    paddingHorizontal: 16,
    marginTop: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.primary + '15',
  },
  addCustomBtnText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.primary,
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
  helperText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 6,
    marginLeft: 4,
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
  pickerText: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  placeholderText: {
    color: Colors.textSecondary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipSelected: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  chipTextSelected: {
    color: '#fff',
  },
  defToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  defCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  defCheckboxActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  defToggleText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#059669',
    marginHorizontal: 16,
    marginTop: 28,
    paddingVertical: 16,
    borderRadius: 14,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#fff',
  },
  bottomPadding: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  equipmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  equipmentRowSelected: {
    backgroundColor: Colors.primary + '08',
  },
  equipmentRowName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  equipmentRowSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    color: Colors.textSecondary,
    paddingVertical: 30,
  },
  flexOne: {
    flex: 1,
  },
  modalOverlayCentered: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContentCentered: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#059669',
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
