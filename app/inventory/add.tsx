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
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Check, ChevronDown } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { CONSUMABLE_CATEGORIES, ConsumableCategory } from '@/types/equipment';

export default function AddConsumableScreen() {
  const router = useRouter();
  const { addConsumable, equipment } = useFarmData();

  const [name, setName] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [category, setCategory] = useState<ConsumableCategory>('filter');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [supplierPartNumber, setSupplierPartNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('2');
  const [notes, setNotes] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [showEquipmentPicker, setShowEquipmentPicker] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) {
        throw new Error('Part name is required');
      }
      if (!partNumber.trim()) {
        throw new Error('Part number is required');
      }

      await addConsumable({
        name: name.trim(),
        partNumber: partNumber.trim(),
        category,
        supplier: supplier.trim() || undefined,
        supplierPartNumber: supplierPartNumber.trim() || undefined,
        quantity: parseInt(quantity) || 0,
        lowStockThreshold: parseInt(lowStockThreshold) || 2,
        compatibleEquipment: selectedEquipment.length > 0 ? selectedEquipment : undefined,
        notes: notes.trim() || undefined,
      });
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

  const toggleEquipment = (id: string) => {
    setSelectedEquipment(prev =>
      prev.includes(id)
        ? prev.filter(e => e !== id)
        : [...prev, id]
    );
  };

  const getCategoryLabel = (cat: ConsumableCategory) => {
    return CONSUMABLE_CATEGORIES.find(c => c.value === cat)?.label ?? cat;
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
          <Text style={styles.sectionTitle}>Part Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Part Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Engine Oil Filter"
              placeholderTextColor={Colors.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Part Number *</Text>
            <TextInput
              style={styles.input}
              value={partNumber}
              onChangeText={setPartNumber}
              placeholder="e.g., RE504836"
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Category</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowCategoryPicker(!showCategoryPicker)}
            >
              <Text style={styles.pickerText}>{getCategoryLabel(category)}</Text>
              <ChevronDown color={Colors.textSecondary} size={20} />
            </TouchableOpacity>

            {showCategoryPicker && (
              <View style={styles.pickerDropdown}>
                {CONSUMABLE_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    style={[
                      styles.pickerOption,
                      category === cat.value && styles.pickerOptionActive,
                    ]}
                    onPress={() => {
                      setCategory(cat.value);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        category === cat.value && styles.pickerOptionTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Supplier Details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Supplier Name</Text>
            <TextInput
              style={styles.input}
              value={supplier}
              onChangeText={setSupplier}
              placeholder="e.g., John Deere, NAPA"
              placeholderTextColor={Colors.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Supplier Part Number</Text>
            <TextInput
              style={styles.input}
              value={supplierPartNumber}
              onChangeText={setSupplierPartNumber}
              placeholder="Cross-reference number"
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="characters"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inventory</Text>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Quantity in Stock</Text>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                placeholder="0"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="number-pad"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Low Stock Alert</Text>
              <TextInput
                style={styles.input}
                value={lowStockThreshold}
                onChangeText={setLowStockThreshold}
                placeholder="2"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compatible Equipment</Text>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setShowEquipmentPicker(!showEquipmentPicker)}
          >
            <Text style={[
              styles.pickerText,
              selectedEquipment.length === 0 && styles.pickerPlaceholder,
            ]}>
              {selectedEquipment.length > 0
                ? `${selectedEquipment.length} equipment selected`
                : 'Select compatible equipment...'}
            </Text>
            <ChevronDown color={Colors.textSecondary} size={20} />
          </TouchableOpacity>

          {showEquipmentPicker && (
            <View style={styles.pickerDropdown}>
              {equipment.map((eq) => (
                <TouchableOpacity
                  key={eq.id}
                  style={[
                    styles.pickerOption,
                    selectedEquipment.includes(eq.id) && styles.pickerOptionActive,
                  ]}
                  onPress={() => toggleEquipment(eq.id)}
                >
                  <View style={styles.checkboxRow}>
                    <View style={[
                      styles.checkbox,
                      selectedEquipment.includes(eq.id) && styles.checkboxActive,
                    ]}>
                      {selectedEquipment.includes(eq.id) && (
                        <Check color={Colors.textOnPrimary} size={14} />
                      )}
                    </View>
                    <View>
                      <Text style={styles.pickerOptionText}>{eq.name}</Text>
                      <Text style={styles.pickerOptionSubtext}>
                        {eq.make} {eq.model}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
              {equipment.length === 0 && (
                <Text style={styles.noEquipmentText}>No equipment added yet</Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional notes, alternate parts, etc..."
            placeholderTextColor={Colors.textSecondary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
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
            {saveMutation.isPending ? 'Saving...' : 'Add Part'}
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
  checkboxRow: {
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
