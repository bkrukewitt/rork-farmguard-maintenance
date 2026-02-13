import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { 
  Plus, 
  ClipboardList,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  ChevronRight,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { WorkOrder, WORK_ORDER_PRIORITIES, WORK_ORDER_STATUSES } from '@/types/equipment';
import { formatDate } from '@/utils/helpers';

type FilterStatus = 'all' | 'pending' | 'in_progress' | 'completed';

export default function WorkOrdersScreen() {
  const router = useRouter();
  const { workOrders, equipment, employees, isLoading } = useFarmData();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  const sortedWorkOrders = useMemo(() => {
    let orders = [...workOrders].sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      if (a.status !== 'completed' && b.status !== 'completed') {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    if (filterStatus !== 'all') {
      orders = orders.filter(order => order.status === filterStatus);
    }
    
    return orders;
  }, [workOrders, filterStatus]);

  const stats = useMemo(() => {
    const pending = workOrders.filter(w => w.status === 'pending').length;
    const inProgress = workOrders.filter(w => w.status === 'in_progress').length;
    const completed = workOrders.filter(w => w.status === 'completed').length;
    const urgent = workOrders.filter(w => w.priority === 'urgent' && w.status !== 'completed').length;
    return { pending, inProgress, completed, urgent };
  }, [workOrders]);

  const getPriorityColor = (priority: string) => {
    const found = WORK_ORDER_PRIORITIES.find(p => p.value === priority);
    return found?.color ?? '#6B7280';
  };

  const getStatusColor = (status: string) => {
    const found = WORK_ORDER_STATUSES.find(s => s.value === status);
    return found?.color ?? '#6B7280';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return CheckCircle2;
      case 'in_progress':
        return Clock;
      default:
        return ClipboardList;
    }
  };

  const renderWorkOrderItem = ({ item }: { item: WorkOrder }) => {
    const eq = equipment.find(e => e.id === item.equipmentId);
    const assignedEmployees = item.assignedTo?.map(id => employees.find(e => e.id === id)?.name).filter(Boolean);
    const StatusIcon = getStatusIcon(item.status);
    const priorityColor = getPriorityColor(item.priority);
    const statusColor = getStatusColor(item.status);

    return (
      <TouchableOpacity
        style={styles.workOrderCard}
        onPress={() => router.push(`/workorders/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={[styles.priorityIndicator, { backgroundColor: priorityColor }]} />
        
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.workOrderTitle} numberOfLines={1}>{item.title}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <StatusIcon color={statusColor} size={12} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {WORK_ORDER_STATUSES.find(s => s.value === item.status)?.label}
              </Text>
            </View>
          </View>
          
          {item.description && (
            <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
          )}
          
          <View style={styles.cardMeta}>
            {eq && (
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Equipment:</Text>
                <Text style={styles.metaValue}>{eq.name}</Text>
              </View>
            )}
            
            {item.dueDate && (
              <View style={styles.metaItem}>
                <Calendar color={Colors.textSecondary} size={12} />
                <Text style={styles.metaValue}>{formatDate(item.dueDate)}</Text>
              </View>
            )}
          </View>
          
          {assignedEmployees && assignedEmployees.length > 0 && (
            <View style={styles.assignedRow}>
              <Text style={styles.assignedLabel}>Assigned:</Text>
              <Text style={styles.assignedNames} numberOfLines={1}>
                {assignedEmployees.join(', ')}
              </Text>
            </View>
          )}
        </View>
        
        <ChevronRight color={Colors.textSecondary} size={20} />
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Work Orders' }} />
      
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#F59E0B' + '15' }]}>
          <Clock color="#F59E0B" size={20} />
          <Text style={[styles.statNumber, { color: '#F59E0B' }]}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#3B82F6' + '15' }]}>
          <ClipboardList color="#3B82F6" size={20} />
          <Text style={[styles.statNumber, { color: '#3B82F6' }]}>{stats.inProgress}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#10B981' + '15' }]}>
          <CheckCircle2 color="#10B981" size={20} />
          <Text style={[styles.statNumber, { color: '#10B981' }]}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        {stats.urgent > 0 && (
          <View style={[styles.statCard, { backgroundColor: '#DC2626' + '15' }]}>
            <AlertTriangle color="#DC2626" size={20} />
            <Text style={[styles.statNumber, { color: '#DC2626' }]}>{stats.urgent}</Text>
            <Text style={styles.statLabel}>Urgent</Text>
          </View>
        )}
      </View>

      <View style={styles.filterContainer}>
        <Filter color={Colors.textSecondary} size={18} />
        <TouchableOpacity
          style={[styles.filterButton, filterStatus === 'all' && styles.filterButtonActive]}
          onPress={() => setFilterStatus('all')}
        >
          <Text style={[styles.filterText, filterStatus === 'all' && styles.filterTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filterStatus === 'pending' && styles.filterButtonActive]}
          onPress={() => setFilterStatus('pending')}
        >
          <Text style={[styles.filterText, filterStatus === 'pending' && styles.filterTextActive]}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filterStatus === 'in_progress' && styles.filterButtonActive]}
          onPress={() => setFilterStatus('in_progress')}
        >
          <Text style={[styles.filterText, filterStatus === 'in_progress' && styles.filterTextActive]}>Active</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filterStatus === 'completed' && styles.filterButtonActive]}
          onPress={() => setFilterStatus('completed')}
        >
          <Text style={[styles.filterText, filterStatus === 'completed' && styles.filterTextActive]}>Done</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sortedWorkOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderWorkOrderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <ClipboardList color={Colors.textSecondary} size={64} />
            <Text style={styles.emptyTitle}>No Work Orders</Text>
            <Text style={styles.emptySubtitle}>
              Create work orders to plan and track future repairs and maintenance tasks
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/workorders/add' as any)}
        activeOpacity={0.8}
      >
        <Plus color={Colors.textOnPrimary} size={28} />
      </TouchableOpacity>
    </View>
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
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 4,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surfaceAlt,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.textOnPrimary,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
  },
  workOrderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  priorityIndicator: {
    width: 4,
    alignSelf: 'stretch',
  },
  cardContent: {
    flex: 1,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  workOrderTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  description: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  cardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  metaValue: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  assignedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  assignedLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginRight: 4,
  },
  assignedNames: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500' as const,
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
