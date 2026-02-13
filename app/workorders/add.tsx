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
  Modal,
  Pressable,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { 
  Save, 
  ChevronDown,
  Calendar,
  X,
  Check,
  Plus,
  User,
} from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { 
  WorkOrderPriority, 
  WorkOrderStatus, 
  WORK_ORDER_PRIORITIES, 
  WORK_ORDER_STATUSES 
} from '@/types/equipment';

export default function AddWorkOrderScreen() {
  const router = useRouter();
  const { equipment, employees, addWorkOrder, addEmployee } = useFarmData();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('');
  const [priority, setPriority] = useState<WorkOrderPriority>('medium');
  const [status, setStatus] = useState<WorkOrderStatus>('pending');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [estimatedHours, setEstimatedHours] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  
  const [showEquipmentPicker, setShowEquipmentPicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);

  const selectedEquipment = useMemo(() => 
    equipment.find(e => e.id === selectedEquipmentId),
    [equipment, selectedEquipmentId]
  );

  const selectedPriority = WORK_ORDER_PRIORITIES.find(p => p.value === priority);
  const selectedStatus = WORK_ORDER_STATUSES.find(s => s.value === status);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for the work order');
      return;
    }

    setIsSaving(true);
    try {
      await addWorkOrder({
        title: title.trim(),
        description: description.trim(),
        equipmentId: selectedEquipmentId || undefined,
        priority,
        status,
        dueDate: dueDate?.toISOString(),
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
        notes: notes.trim() || undefined,
        assignedTo: assignedTo.length > 0 ? assignedTo : undefined,
      });
      
      router.back();
    } catch (error) {
      console.error('Error adding work order:', error);
      Alert.alert('Error', 'Failed to create work order');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddEmployee = async () => {
    if (!newEmployeeName.trim()) {
      Alert.alert('Error', 'Please enter employee name');
      return;
    }

    try {
      const newEmployee = await addEmployee({
        name: newEmployeeName.trim(),
        role: newEmployeeRole.trim() || undefined,
      });
      setAssignedTo([...assignedTo, newEmployee.id]);
      setNewEmployeeName('');
      setNewEmployeeRole('');
      setShowAddEmployee(false);
    } catch (error) {
      console.error('Error adding employee:', error);
      Alert.alert('Error', 'Failed to add employee');
    }
  };

  const toggleEmployee = (employeeId: string) => {
    if (assignedTo.includes(employeeId)) {
      setAssignedTo(assignedTo.filter(id => id !== employeeId));
    } else {
      setAssignedTo([...assignedTo, employeeId]);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'New Work Order',
          headerRight: () => (
            <TouchableOpacity onPress={handleSave} disabled={isSaving}>
              <Save color={isSaving ? Colors.textSecondary : Colors.primary} size={24} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Replace hydraulic hose"
              placeholderTextColor={Colors.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the work to be done..."
              placeholderTextColor={Colors.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Equipment</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowEquipmentPicker(true)}
            >
              <Text style={[styles.pickerButtonText, !selectedEquipment && styles.placeholderText]}>
                {selectedEquipment?.name ?? 'Select equipment (optional)'}
              </Text>
              <ChevronDown color={Colors.textSecondary} size={20} />
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Priority</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowPriorityPicker(true)}
              >
                <View style={[styles.colorDot, { backgroundColor: selectedPriority?.color }]} />
                <Text style={styles.pickerButtonText}>{selectedPriority?.label}</Text>
                <ChevronDown color={Colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Status</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowStatusPicker(true)}
              >
                <View style={[styles.colorDot, { backgroundColor: selectedStatus?.color }]} />
                <Text style={styles.pickerButtonText}>{selectedStatus?.label}</Text>
                <ChevronDown color={Colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Due Date</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Calendar color={Colors.textSecondary} size={18} />
                <Text style={[styles.pickerButtonText, !dueDate && styles.placeholderText]}>
                  {dueDate ? formatDate(dueDate) : 'Select date'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Est. Hours</Text>
              <TextInput
                style={styles.input}
                value={estimatedHours}
                onChangeText={setEstimatedHours}
                placeholder="0"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Assign To</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowEmployeePicker(true)}
            >
              <Plus color={Colors.primary} size={18} />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>

          {assignedTo.length > 0 ? (
            <View style={styles.assignedList}>
              {assignedTo.map(employeeId => {
                const employee = employees.find(e => e.id === employeeId);
                if (!employee) return null;
                return (
                  <View key={employeeId} style={styles.assignedChip}>
                    <User color={Colors.primary} size={14} />
                    <Text style={styles.assignedChipText}>{employee.name}</Text>
                    <TouchableOpacity onPress={() => toggleEmployee(employeeId)}>
                      <X color={Colors.textSecondary} size={16} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.noAssignedText}>No employees assigned</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional notes..."
            placeholderTextColor={Colors.textSecondary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Save color={Colors.textOnPrimary} size={20} />
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Creating...' : 'Create Work Order'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showEquipmentPicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowEquipmentPicker(false)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Equipment</Text>
              <TouchableOpacity onPress={() => setShowEquipmentPicker(false)}>
                <X color={Colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  setSelectedEquipmentId('');
                  setShowEquipmentPicker(false);
                }}
              >
                <Text style={styles.modalOptionText}>None</Text>
                {!selectedEquipmentId && <Check color={Colors.primary} size={20} />}
              </TouchableOpacity>
              {equipment.map(eq => (
                <TouchableOpacity
                  key={eq.id}
                  style={styles.modalOption}
                  onPress={() => {
                    setSelectedEquipmentId(eq.id);
                    setShowEquipmentPicker(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{eq.name}</Text>
                  {selectedEquipmentId === eq.id && <Check color={Colors.primary} size={20} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showPriorityPicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowPriorityPicker(false)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Priority</Text>
              <TouchableOpacity onPress={() => setShowPriorityPicker(false)}>
                <X color={Colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {WORK_ORDER_PRIORITIES.map(p => (
                <TouchableOpacity
                  key={p.value}
                  style={styles.modalOption}
                  onPress={() => {
                    setPriority(p.value);
                    setShowPriorityPicker(false);
                  }}
                >
                  <View style={styles.modalOptionLeft}>
                    <View style={[styles.colorDot, { backgroundColor: p.color }]} />
                    <Text style={styles.modalOptionText}>{p.label}</Text>
                  </View>
                  {priority === p.value && <Check color={Colors.primary} size={20} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showStatusPicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowStatusPicker(false)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Status</Text>
              <TouchableOpacity onPress={() => setShowStatusPicker(false)}>
                <X color={Colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {WORK_ORDER_STATUSES.map(s => (
                <TouchableOpacity
                  key={s.value}
                  style={styles.modalOption}
                  onPress={() => {
                    setStatus(s.value);
                    setShowStatusPicker(false);
                  }}
                >
                  <View style={styles.modalOptionLeft}>
                    <View style={[styles.colorDot, { backgroundColor: s.color }]} />
                    <Text style={styles.modalOptionText}>{s.label}</Text>
                  </View>
                  {status === s.value && <Check color={Colors.primary} size={20} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showEmployeePicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowEmployeePicker(false)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Employees</Text>
              <TouchableOpacity onPress={() => setShowEmployeePicker(false)}>
                <X color={Colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {employees.length === 0 ? (
                <Text style={styles.noEmployeesText}>No employees added yet</Text>
              ) : (
                employees.map(emp => (
                  <TouchableOpacity
                    key={emp.id}
                    style={styles.modalOption}
                    onPress={() => toggleEmployee(emp.id)}
                  >
                    <View style={styles.modalOptionLeft}>
                      <User color={Colors.textSecondary} size={18} />
                      <View>
                        <Text style={styles.modalOptionText}>{emp.name}</Text>
                        {emp.role && <Text style={styles.employeeRole}>{emp.role}</Text>}
                      </View>
                    </View>
                    {assignedTo.includes(emp.id) && <Check color={Colors.primary} size={20} />}
                  </TouchableOpacity>
                ))
              )}
              <TouchableOpacity
                style={styles.addEmployeeButton}
                onPress={() => {
                  setShowEmployeePicker(false);
                  setShowAddEmployee(true);
                }}
              >
                <Plus color={Colors.primary} size={18} />
                <Text style={styles.addEmployeeButtonText}>Add New Employee</Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showAddEmployee} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddEmployee(false)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Employee</Text>
              <TouchableOpacity onPress={() => setShowAddEmployee(false)}>
                <X color={Colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            <View style={styles.addEmployeeForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={newEmployeeName}
                  onChangeText={setNewEmployeeName}
                  placeholder="Employee name"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Role</Text>
                <TextInput
                  style={styles.input}
                  value={newEmployeeRole}
                  onChangeText={setNewEmployeeRole}
                  placeholder="e.g., Mechanic, Operator"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
              <TouchableOpacity style={styles.saveEmployeeButton} onPress={handleAddEmployee}>
                <Text style={styles.saveEmployeeButtonText}>Add Employee</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {showDatePicker && (
        <DateTimePicker
          value={dueDate ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (date) setDueDate(date);
          }}
          minimumDate={new Date()}
        />
      )}
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
  section: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
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
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: Colors.text,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  pickerButtonText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  placeholderText: {
    color: Colors.textSecondary,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  assignedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  assignedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  assignedChipText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  noAssignedText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    marginHorizontal: 16,
    marginVertical: 24,
    padding: 16,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  modalList: {
    padding: 16,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalOptionText: {
    fontSize: 15,
    color: Colors.text,
  },
  employeeRole: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  noEmployeesText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  addEmployeeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  addEmployeeButtonText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  addEmployeeForm: {
    padding: 16,
  },
  saveEmployeeButton: {
    backgroundColor: Colors.primary,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  saveEmployeeButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textOnPrimary,
  },
});
