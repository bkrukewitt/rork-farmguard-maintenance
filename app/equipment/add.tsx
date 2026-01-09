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
import { 
  Tractor, 
  Truck, 
  Wheat, 
  Wrench as Tool, 
  Droplets, 
  Sprout, 
  Container, 
  Settings,
  Check,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { EquipmentType, DEFAULT_MAINTENANCE_INTERVALS } from '@/types/equipment';

const EQUIPMENT_TYPES: { value: EquipmentType; label: string; Icon: React.ComponentType<{ color: string; size: number }> }[] = [
  { value: 'tractor', label: 'Tractor', Icon: Tractor },
  { value: 'combine', label: 'Combine', Icon: Wheat },
  { value: 'truck', label: 'Truck', Icon: Truck },
  { value: 'implement', label: 'Implement', Icon: Tool },
  { value: 'sprayer', label: 'Sprayer', Icon: Droplets },
  { value: 'planter', label: 'Planter', Icon: Sprout },
  { value: 'loader', label: 'Loader', Icon: Container },
  { value: 'other', label: 'Other', Icon: Settings },
];

export default function AddEquipmentScreen() {
  const router = useRouter();
  const { addEquipment, addInterval } = useFarmData();

  const [name, setName] = useState('');
  const [type, setType] = useState<EquipmentType>('tractor');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [currentHours, setCurrentHours] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [notes, setNotes] = useState('');

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) {
        throw new Error('Equipment name is required');
      }
      if (!make.trim()) {
        throw new Error('Make is required');
      }
      if (!model.trim()) {
        throw new Error('Model is required');
      }

      const equipment = await addEquipment({
        name: name.trim(),
        type,
        make: make.trim(),
        model: model.trim(),
        year: parseInt(year) || new Date().getFullYear(),
        serialNumber: serialNumber.trim(),
        currentHours: parseFloat(currentHours) || 0,
        purchaseDate: purchaseDate || new Date().toISOString().split('T')[0],
        notes: notes.trim(),
      });

      for (const interval of DEFAULT_MAINTENANCE_INTERVALS) {
        await addInterval({
          equipmentId: equipment.id,
          name: interval.name,
          intervalHours: interval.intervalHours,
          intervalDays: interval.intervalDays,
          lastPerformedHours: parseFloat(currentHours) || 0,
          lastPerformedDate: new Date().toISOString(),
        });
      }

      return equipment;
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
          <Text style={styles.sectionTitle}>Equipment Type</Text>
          <View style={styles.typeGrid}>
            {EQUIPMENT_TYPES.map(({ value, label, Icon }) => (
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
                  size={24} 
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
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name / Nickname *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Main Tractor, Big Red"
              placeholderTextColor={Colors.textSecondary}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Make *</Text>
              <TextInput
                style={styles.input}
                value={make}
                onChangeText={setMake}
                placeholder="John Deere"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Model *</Text>
              <TextInput
                style={styles.input}
                value={model}
                onChangeText={setModel}
                placeholder="8R 410"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Year</Text>
              <TextInput
                style={styles.input}
                value={year}
                onChangeText={setYear}
                placeholder="2024"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Current Hours</Text>
              <TextInput
                style={styles.input}
                value={currentHours}
                onChangeText={setCurrentHours}
                placeholder="0"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Serial Number</Text>
            <TextInput
              style={styles.input}
              value={serialNumber}
              onChangeText={setSerialNumber}
              placeholder="Enter serial number"
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Purchase Date</Text>
            <TextInput
              style={styles.input}
              value={purchaseDate}
              onChangeText={setPurchaseDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional notes about this equipment..."
              placeholderTextColor={Colors.textSecondary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Default Maintenance Schedules</Text>
          <Text style={styles.infoText}>
            Standard maintenance intervals will be automatically created for this equipment. 
            You can customize them later from the equipment details screen.
          </Text>
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
            {saveMutation.isPending ? 'Saving...' : 'Save Equipment'}
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
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeButton: {
    width: '23%',
    aspectRatio: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  typeButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
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
    minHeight: 100,
    paddingTop: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  infoCard: {
    backgroundColor: Colors.primary + '10',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
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
    backgroundColor: Colors.primary,
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
