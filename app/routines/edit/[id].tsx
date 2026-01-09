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
  Plus, 
  Check, 
  Trash2,
  GripVertical,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { generateId } from '@/utils/helpers';

interface ChecklistItemDraft {
  id: string;
  text: string;
}

export default function EditServiceRoutineScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getServiceRoutineById, updateServiceRoutine, isLoading } = useFarmData();

  const routine = getServiceRoutineById(id ?? '');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [checklistItems, setChecklistItems] = useState<ChecklistItemDraft[]>([]);

  useEffect(() => {
    if (routine) {
      setName(routine.name);
      setDescription(routine.description ?? '');
      setChecklistItems(
        routine.checklistItems.map(item => ({
          id: item.id,
          text: item.text,
        }))
      );
    }
  }, [routine]);

  const addChecklistItem = () => {
    setChecklistItems(prev => [...prev, { id: generateId(), text: '' }]);
  };

  const updateChecklistItem = (itemId: string, text: string) => {
    setChecklistItems(prev =>
      prev.map(item => (item.id === itemId ? { ...item, text } : item))
    );
  };

  const removeChecklistItem = (itemId: string) => {
    if (checklistItems.length <= 1) {
      Alert.alert('Cannot Remove', 'A routine must have at least one checklist item.');
      return;
    }
    setChecklistItems(prev => prev.filter(item => item.id !== itemId));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) {
        throw new Error('Routine name is required');
      }

      const validItems = checklistItems.filter(item => item.text.trim());
      if (validItems.length === 0) {
        throw new Error('At least one checklist item is required');
      }

      await updateServiceRoutine({
        id: id!,
        name: name.trim(),
        description: description.trim() || undefined,
        checklistItems: validItems.map(item => ({
          id: item.id,
          text: item.text.trim(),
        })),
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

  if (isLoading || !routine) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit Routine',
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.text,
        }}
      />
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
            <Text style={styles.sectionTitle}>Routine Details</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g., 250 Hour Service"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Optional description of this routine"
                placeholderTextColor={Colors.textSecondary}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Checklist Items</Text>
              <TouchableOpacity
                style={styles.addItemButton}
                onPress={addChecklistItem}
              >
                <Plus color={Colors.primary} size={18} />
                <Text style={styles.addItemText}>Add Item</Text>
              </TouchableOpacity>
            </View>

            {checklistItems.map((item, index) => (
              <View key={item.id} style={styles.checklistItemRow}>
                <View style={styles.itemHandle}>
                  <GripVertical color={Colors.textSecondary} size={18} />
                </View>
                <Text style={styles.itemNumber}>{index + 1}.</Text>
                <TextInput
                  style={styles.checklistInput}
                  value={item.text}
                  onChangeText={(text) => updateChecklistItem(item.id, text)}
                  placeholder="Enter checklist item..."
                  placeholderTextColor={Colors.textSecondary}
                />
                <TouchableOpacity
                  style={styles.removeItemButton}
                  onPress={() => removeChecklistItem(item.id)}
                >
                  <Trash2 color={Colors.danger} size={18} />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={styles.addItemRowButton}
              onPress={addChecklistItem}
            >
              <Plus color={Colors.textSecondary} size={18} />
              <Text style={styles.addItemRowText}>Add another item</Text>
            </TouchableOpacity>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addItemText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500' as const,
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
    minHeight: 70,
    paddingTop: 14,
  },
  checklistItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    marginBottom: 8,
    paddingVertical: 4,
  },
  itemHandle: {
    padding: 10,
  },
  itemNumber: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
    marginRight: 8,
  },
  checklistInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 10,
  },
  removeItemButton: {
    padding: 12,
  },
  addItemRowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 10,
    gap: 8,
    marginTop: 4,
  },
  addItemRowText: {
    fontSize: 14,
    color: Colors.textSecondary,
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
