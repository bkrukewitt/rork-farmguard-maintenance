import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import {
  Package,
  Edit3,
  Trash2,
  AlertTriangle,
  Plus,
  Minus,
  Check,
  X,
  ChevronDown,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { CONSUMABLE_CATEGORIES, ConsumableCategory } from '@/types/equipment';

export default function ConsumableDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getConsumableById, updateConsumable, deleteConsumable, equipment } = useFarmData();

  const consumable = getConsumableById(id ?? '');

  const [isEditing, setIsEditing] = useState(false);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [quantityChange, setQuantityChange] = useState('');
  const [isAdding, setIsAdding] = useState(true);

  const [editName, setEditName] = useState('');
  const [editPartNumber, setEditPartNumber] = useState('');
  const [editCategory, setEditCategory] = useState<ConsumableCategory>('filter');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [editSupplier, setEditSupplier] = useState('');
  const [editSupplierPartNumber, setEditSupplierPartNumber] = useState('');
  const [editLowStockThreshold, setEditLowStockThreshold] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const startEditing = () => {
    if (consumable) {
      setEditName(consumable.name);
      setEditPartNumber(consumable.partNumber);
      setEditCategory(consumable.category);
      setEditSupplier(consumable.supplier ?? '');
      setEditSupplierPartNumber(consumable.supplierPartNumber ?? '');
      setEditLowStockThreshold(consumable.lowStockThreshold.toString());
      setEditNotes(consumable.notes ?? '');
      setIsEditing(true);
    }
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editName.trim()) throw new Error('Part name is required');
      if (!editPartNumber.trim()) throw new Error('Part number is required');

      await updateConsumable({
        id: id ?? '',
        name: editName.trim(),
        partNumber: editPartNumber.trim(),
        category: editCategory,
        supplier: editSupplier.trim() || undefined,
        supplierPartNumber: editSupplierPartNumber.trim() || undefined,
        lowStockThreshold: parseInt(editLowStockThreshold) || 2,
        notes: editNotes.trim() || undefined,
      });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const quantityMutation = useMutation({
    mutationFn: async () => {
      const change = parseInt(quantityChange);
      if (isNaN(change) || change <= 0) {
        throw new Error('Please enter a valid quantity');
      }
      const newQuantity = isAdding
        ? (consumable?.quantity ?? 0) + change
        : Math.max(0, (consumable?.quantity ?? 0) - change);

      await updateConsumable({
        id: id ?? '',
        quantity: newQuantity,
      });
      setShowQuantityModal(false);
      setQuantityChange('');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await deleteConsumable(id ?? '');
    },
    onSuccess: () => {
      router.back();
    },
  });

  const handleDelete = () => {
    Alert.alert(
      'Delete Part',
      `Are you sure you want to delete "${consumable?.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ]
    );
  };

  const getCategoryLabel = (cat: ConsumableCategory) => {
    return CONSUMABLE_CATEGORIES.find(c => c.value === cat)?.label ?? cat;
  };

  const getEquipmentName = (eqId: string) => {
    return equipment.find(e => e.id === eqId)?.name ?? 'Unknown';
  };

  if (!consumable) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Part not found</Text>
      </View>
    );
  }

  const isLowStock = consumable.quantity <= consumable.lowStockThreshold;

  if (isEditing) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Stack.Screen options={{ title: 'Edit Part' }} />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Part Name *</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Part name"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Part Number *</Text>
              <TextInput
                style={styles.input}
                value={editPartNumber}
                onChangeText={setEditPartNumber}
                placeholder="Part number"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowCategoryPicker(!showCategoryPicker)}
              >
                <Text style={styles.pickerText}>{getCategoryLabel(editCategory)}</Text>
                <ChevronDown color={Colors.textSecondary} size={20} />
              </TouchableOpacity>
              {showCategoryPicker && (
                <View style={styles.pickerDropdown}>
                  {CONSUMABLE_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.value}
                      style={[
                        styles.pickerOption,
                        editCategory === cat.value && styles.pickerOptionActive,
                      ]}
                      onPress={() => {
                        setEditCategory(cat.value);
                        setShowCategoryPicker(false);
                      }}
                    >
                      <Text style={[
                        styles.pickerOptionText,
                        editCategory === cat.value && styles.pickerOptionTextActive,
                      ]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Supplier</Text>
              <TextInput
                style={styles.input}
                value={editSupplier}
                onChangeText={setEditSupplier}
                placeholder="Supplier name"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Supplier Part Number</Text>
              <TextInput
                style={styles.input}
                value={editSupplierPartNumber}
                onChangeText={setEditSupplierPartNumber}
                placeholder="Cross-reference number"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Low Stock Alert</Text>
              <TextInput
                style={styles.input}
                value={editLowStockThreshold}
                onChangeText={setEditLowStockThreshold}
                placeholder="2"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Additional notes..."
                placeholderTextColor={Colors.textSecondary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => setIsEditing(false)}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, updateMutation.isPending && styles.saveButtonDisabled]}
            onPress={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
          >
            <Check color={Colors.textOnPrimary} size={20} />
            <Text style={styles.saveButtonText}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: consumable.name }} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={[styles.iconContainer, isLowStock && styles.iconContainerLow]}>
            {isLowStock ? (
              <AlertTriangle color={Colors.danger} size={32} />
            ) : (
              <Package color={Colors.primary} size={32} />
            )}
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.partName}>{consumable.name}</Text>
            <Text style={styles.partNumber}>#{consumable.partNumber}</Text>
          </View>
        </View>

        {isLowStock && (
          <View style={styles.lowStockBanner}>
            <AlertTriangle color={Colors.danger} size={18} />
            <Text style={styles.lowStockText}>
              Low Stock! Only {consumable.quantity} remaining (threshold: {consumable.lowStockThreshold})
            </Text>
          </View>
        )}

        <View style={styles.quantitySection}>
          <View style={styles.quantityDisplay}>
            <Text style={styles.quantityLabel}>In Stock</Text>
            <Text style={[styles.quantityValue, isLowStock && styles.quantityValueLow]}>
              {consumable.quantity}
            </Text>
          </View>
          <View style={styles.quantityActions}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => {
                setIsAdding(false);
                setShowQuantityModal(true);
              }}
            >
              <Minus color={Colors.danger} size={20} />
              <Text style={styles.quantityButtonText}>Remove</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quantityButton, styles.quantityButtonAdd]}
              onPress={() => {
                setIsAdding(true);
                setShowQuantityModal(true);
              }}
            >
              <Plus color={Colors.success} size={20} />
              <Text style={[styles.quantityButtonText, styles.quantityButtonTextAdd]}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {showQuantityModal && (
          <View style={styles.quantityModal}>
            <View style={styles.quantityModalHeader}>
              <Text style={styles.quantityModalTitle}>
                {isAdding ? 'Add Stock' : 'Remove Stock'}
              </Text>
              <TouchableOpacity onPress={() => setShowQuantityModal(false)}>
                <X color={Colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.quantityInput}
              value={quantityChange}
              onChangeText={setQuantityChange}
              placeholder="Enter quantity"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="number-pad"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.confirmButton, quantityMutation.isPending && styles.confirmButtonDisabled]}
              onPress={() => quantityMutation.mutate()}
              disabled={quantityMutation.isPending}
            >
              <Text style={styles.confirmButtonText}>
                {quantityMutation.isPending ? 'Updating...' : 'Confirm'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.detailsCard}>
          <Text style={styles.cardTitle}>Details</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Category</Text>
            <Text style={styles.detailValue}>{getCategoryLabel(consumable.category)}</Text>
          </View>

          {consumable.supplier && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Supplier</Text>
              <Text style={styles.detailValue}>{consumable.supplier}</Text>
            </View>
          )}

          {consumable.supplierPartNumber && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Supplier P/N</Text>
              <Text style={styles.detailValue}>{consumable.supplierPartNumber}</Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Low Stock Threshold</Text>
            <Text style={styles.detailValue}>{consumable.lowStockThreshold}</Text>
          </View>
        </View>

        {consumable.compatibleEquipment && consumable.compatibleEquipment.length > 0 && (
          <View style={styles.detailsCard}>
            <Text style={styles.cardTitle}>Compatible Equipment</Text>
            {consumable.compatibleEquipment.map((eqId) => (
              <View key={eqId} style={styles.equipmentItem}>
                <Text style={styles.equipmentName}>{getEquipmentName(eqId)}</Text>
              </View>
            ))}
          </View>
        )}

        {consumable.notes && (
          <View style={styles.detailsCard}>
            <Text style={styles.cardTitle}>Notes</Text>
            <Text style={styles.notesText}>{consumable.notes}</Text>
          </View>
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.editButton} onPress={startEditing}>
            <Edit3 color={Colors.primary} size={20} />
            <Text style={styles.editButtonText}>Edit Part</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Trash2 color={Colors.danger} size={20} />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
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
    paddingBottom: 40,
  },
  errorText: {
    textAlign: 'center',
    color: Colors.textSecondary,
    marginTop: 40,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerLow: {
    backgroundColor: Colors.danger + '15',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  partName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  partNumber: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  lowStockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger + '15',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 10,
  },
  lowStockText: {
    flex: 1,
    fontSize: 14,
    color: Colors.danger,
    fontWeight: '500' as const,
  },
  quantitySection: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quantityDisplay: {
    alignItems: 'center',
    marginBottom: 16,
  },
  quantityLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  quantityValue: {
    fontSize: 48,
    fontWeight: '700' as const,
    color: Colors.success,
  },
  quantityValueLow: {
    color: Colors.danger,
  },
  quantityActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quantityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.danger + '10',
    gap: 8,
  },
  quantityButtonAdd: {
    backgroundColor: Colors.success + '10',
  },
  quantityButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.danger,
  },
  quantityButtonTextAdd: {
    color: Colors.success,
  },
  quantityModal: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quantityModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  quantityModalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  quantityInput: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textOnPrimary,
  },
  detailsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  detailValueBold: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '700' as const,
  },
  equipmentItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  equipmentName: {
    fontSize: 14,
    color: Colors.text,
  },
  notesText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 8,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.danger,
    gap: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.danger,
  },
  section: {
    marginBottom: 24,
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
