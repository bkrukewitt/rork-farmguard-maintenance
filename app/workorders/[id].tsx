import React, { useState, useMemo, useEffect } from 'react';
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
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { 
  Save, 
  ChevronDown,
  Calendar,
  X,
  Check,
  Plus,
  User,
  Trash2,
  Clock,
  Wrench,
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
import { formatDate } from '@/utils/helpers';

export default function WorkOrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { 
    getWorkOrderById, 
    equipment, 
    employees, 
    updateWorkOrder, 
    deleteWorkOrder,
    addEmployee 
  } = useFarmData();
  
  const workOrder = getWorkOrderById(id);
  
  const [isEditing, setIsEditing] = useState(false);
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

  useEffect(() => {
    if (workOrder) {
      setTitle(workOrder.title);
      setDescription(workOrder.description || '');
      setSelectedEquipmentId(workOrder.equipmentId || '');
      setPriority(workOrder.priority);
      setStatus(workOrder.status);
      setDueDate(workOrder.dueDate ? new Date(workOrder.dueDate) : null);
      setEstimatedHours(workOrder.estimatedHours?.toString() || '');
      setNotes(workOrder.notes || '');
      setAssignedTo(workOrder.assignedTo || []);
    }
  }, [workOrder]);

  const selectedEquipment = useMemo(() => 
    equipment.find(e => e.id === selectedEquipmentId),
    [equipment, selectedEquipmentId]
  );

  const selectedPriority = WORK_ORDER_PRIORITIES.find(p => p.value === priority);
  const selectedStatus = WORK_ORDER_STATUSES.find(s => s.value === status);

  if (!workOrder) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Work Order' }} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Work order not found</Text>
        </View>
      </View>
    );
  }

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for the work order');
      return;
    }

    setIsSaving(true);
    try {
      await updateWorkOrder({
        id: workOrder.id,
        title: title.trim(),
        description: description.trim(),
        equipmentId: selectedEquipmentId || undefined,
        priority,
        status,
        dueDate: dueDate?.toISOString(),
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
        notes: notes.trim() || undefined,
        assignedTo: assignedTo.length > 0 ? assignedTo : undefined,
        completedAt: status === 'completed' && workOrder.status !== 'completed' 
          ? new Date().toISOString() 
          : workOrder.completedAt,
      });
      
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating work order:', error);
      Alert.alert('Error', 'Failed to update work order');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Work Order',
      'Are you sure you want to delete this work order? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWorkOrder(workOrder.id);
              router.back();
            } catch (error) {
              console.error('Error deleting work order:', error);
              Alert.alert('Error', 'Failed to delete work order');
            }
          },
        },
      ]
    );
  };

  const handleQuickStatusChange = async (newStatus: WorkOrderStatus) => {
    try {
      await updateWorkOrder({
        id: workOrder.id,
        status: newStatus,
        completedAt: newStatus === 'completed' ? new Date().toISOString() : undefined,
      });
    } catch (error) {
      console.error('Error updating status:', error);
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

  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const eq = equipment.find(e => e.id === workOrder.equipmentId);
  const assignedEmployees = workOrder.assignedTo?.map(id => employees.find(e => e.id === id)).filter(Boolean);

  if (isEditing) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Edit Work Order',
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
                    {dueDate ? formatDateDisplay(dueDate) : 'Select date'}
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

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setIsEditing(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
            >
              <Save color={Colors.textOnPrimary} size={20} />
              <Text style={styles.saveButtonText}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          </View>
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
                {equipment.map(eqItem => (
                  <TouchableOpacity
                    key={eqItem.id}
                    style={styles.modalOption}
                    onPress={() => {
                      setSelectedEquipmentId(eqItem.id);
                      setShowEquipmentPicker(false);
                    }}
                  >
                    <Text style={styles.modalOptionText}>{eqItem.name}</Text>
                    {selectedEquipmentId === eqItem.id && <Check color={Colors.primary} size={20} />}
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
          />
        )}
      </View>
    );
  }

  const priorityInfo = WORK_ORDER_PRIORITIES.find(p => p.value === workOrder.priority);
  const statusInfo = WORK_ORDER_STATUSES.find(s => s.value === workOrder.status);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Work Order',
          headerRight: () => (
            <TouchableOpacity onPress={() => setIsEditing(true)}>
              <Text style={styles.editButton}>Edit</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={[styles.priorityBadge, { backgroundColor: priorityInfo?.color + '20' }]}>
              <View style={[styles.priorityDot, { backgroundColor: priorityInfo?.color }]} />
              <Text style={[styles.priorityText, { color: priorityInfo?.color }]}>
                {priorityInfo?.label} Priority
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo?.color + '20' }]}>
              <Text style={[styles.statusText, { color: statusInfo?.color }]}>
                {statusInfo?.label}
              </Text>
            </View>
          </View>
          
          <Text style={styles.title}>{workOrder.title}</Text>
          
          {workOrder.description && (
            <Text style={styles.description}>{workOrder.description}</Text>
          )}

          <View style={styles.quickActions}>
            {workOrder.status !== 'completed' && (
              <>
                {workOrder.status === 'pending' && (
                  <TouchableOpacity
                    style={[styles.quickActionButton, { backgroundColor: '#3B82F6' }]}
                    onPress={() => handleQuickStatusChange('in_progress')}
                  >
                    <Clock color="#fff" size={16} />
                    <Text style={styles.quickActionText}>Start Work</Text>
                  </TouchableOpacity>
                )}
                {workOrder.status === 'in_progress' && (
                  <TouchableOpacity
                    style={[styles.quickActionButton, { backgroundColor: '#10B981' }]}
                    onPress={() => handleQuickStatusChange('completed')}
                  >
                    <Check color="#fff" size={16} />
                    <Text style={styles.quickActionText}>Mark Complete</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          
          {eq && (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Wrench color={Colors.textSecondary} size={18} />
              </View>
              <View>
                <Text style={styles.detailLabel}>Equipment</Text>
                <Text style={styles.detailValue}>{eq.name}</Text>
              </View>
            </View>
          )}

          {workOrder.dueDate && (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Calendar color={Colors.textSecondary} size={18} />
              </View>
              <View>
                <Text style={styles.detailLabel}>Due Date</Text>
                <Text style={styles.detailValue}>{formatDate(workOrder.dueDate)}</Text>
              </View>
            </View>
          )}

          {workOrder.estimatedHours && (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Clock color={Colors.textSecondary} size={18} />
              </View>
              <View>
                <Text style={styles.detailLabel}>Estimated Time</Text>
                <Text style={styles.detailValue}>{workOrder.estimatedHours} hours</Text>
              </View>
            </View>
          )}
        </View>

        {assignedEmployees && assignedEmployees.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assigned To</Text>
            <View style={styles.assignedList}>
              {assignedEmployees.map(emp => emp && (
                <View key={emp.id} style={styles.employeeCard}>
                  <View style={styles.employeeAvatar}>
                    <User color={Colors.primary} size={20} />
                  </View>
                  <View>
                    <Text style={styles.employeeName}>{emp.name}</Text>
                    {emp.role && <Text style={styles.employeeRoleText}>{emp.role}</Text>}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {workOrder.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{workOrder.notes}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <View style={styles.timelineItem}>
            <Text style={styles.timelineLabel}>Created</Text>
            <Text style={styles.timelineValue}>{formatDate(workOrder.createdAt)}</Text>
          </View>
          {workOrder.completedAt && (
            <View style={styles.timelineItem}>
              <Text style={styles.timelineLabel}>Completed</Text>
              <Text style={styles.timelineValue}>{formatDate(workOrder.completedAt)}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Trash2 color="#EF4444" size={20} />
          <Text style={styles.deleteButtonText}>Delete Work Order</Text>
        </TouchableOpacity>
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
  notFound: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  editButton: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  headerCard: {
    backgroundColor: Colors.surface,
    margin: 16,
    padding: 16,
    borderRadius: 14,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  quickActions: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  section: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginBottom: 16,
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
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  assignedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  employeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 10,
  },
  employeeAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  employeeName: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  employeeRoleText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  notesText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  timelineLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  timelineValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 40,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    gap: 8,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#EF4444',
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
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginVertical: 24,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.surfaceAlt,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
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
