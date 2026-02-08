import React, { useState, useEffect } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import {
  Wrench,
  AlertCircle,
  ClipboardCheck,
  Check,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { MaintenanceLog } from '@/types/equipment';

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
  const { getMaintenanceLogById, getEquipmentById, updateMaintenanceLog, isLoading } = useFarmData();

  const log = getMaintenanceLogById(id ?? '');
  const equipment = log ? getEquipmentById(log.equipmentId) : undefined;

  const [type, setType] = useState<MaintenanceLog['type']>('routine');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [hoursAtService, setHoursAtService] = useState('');
  const [performedBy, setPerformedBy] = useState<MaintenanceLog['performedBy']>('owner');
  const [notes, setNotes] = useState('');

  // Initialize form from log data
  useEffect(() => {
    if (log) {
      setType(log.type);
      setDescription(log.description);
      setDate(log.date);
      setHoursAtService(log.hoursAtService.toString());
      setPerformedBy(log.performedBy);
      setNotes(log.notes ?? '');
    }
  }, [log?.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!description.trim()) {
        throw new Error('Description is required');
      }

      await updateMaintenanceLog({
        id: id ?? '',
        type,
        description: description.trim(),
        date,
        hoursAtService: parseFloat(hoursAtService) || 0,
        performedBy,
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
      <Stack.Screen options={{ title: 'Edit Service Record' }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
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
              {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
