import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
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
import { useFarmData } from '@/contexts/FarmDataContext';
import { useTheme } from '@/contexts/ThemeContext';
import { WorkOrder, WORK_ORDER_PRIORITIES, WORK_ORDER_STATUSES } from '@/types/equipment';
import { formatDate } from '@/utils/helpers';

type FilterStatus = 'all' | 'pending' | 'in_progress' | 'completed';

export default function WorkOrdersScreen() {
  const router = useRouter();
  const { workOrders, equipment, employees, isLoading } = useFarmData();
  const { colors } = useTheme();
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
      orders = orders.filter((order) => order.status === filterStatus);
    }

    return orders;
  }, [workOrders, filterStatus]);

  const stats = useMemo(() => {
    const pending = workOrders.filter((w) => w.status === 'pending').length;
    const inProgress = workOrders.filter((w) => w.status === 'in_progress').length;
    const completed = workOrders.filter((w) => w.status === 'completed').length;
    const urgent = workOrders.filter((w) => w.priority === 'urgent' && w.status !== 'completed').length;
    return { pending, inProgress, completed, urgent };
  }, [workOrders]);

  const getPriorityColor = (priority: string) => {
    const found = WORK_ORDER_PRIORITIES.find((p) => p.value === priority);
    return found?.color ?? '#6B7280';
  };

  const getStatusColor = (status: string) => {
    const found = WORK_ORDER_STATUSES.find((s) => s.value === status);
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
    const eq = equipment.find((e) => e.id === item.equipmentId);
    const assignedEmployees = item.assignedTo
      ?.map((id) => employees.find((e) => e.id === id)?.name)
      .filter(Boolean);
    const StatusIcon = getStatusIcon(item.status);
    const priorityColor = getPriorityColor(item.priority);
    const statusColor = getStatusColor(item.status);

    return (
      <TouchableOpacity
        style={[styles.workOrderCard, { backgroundColor: colors.surface, shadowColor: colors.cardShadow }]}
        onPress={() => router.push(`/workorders/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={[styles.priorityIndicator, { backgroundColor: priorityColor }]} />

        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={[styles.workOrderTitle, { color: colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <StatusIcon color={statusColor} size={12} />
              <Text style={[styles.statusText, { color: statusColor }]} numberOfLines={1}>
                {WORK_ORDER_STATUSES.find((s) => s.value === item.status)?.label}
              </Text>
            </View>
          </View>

          {item.description && (
            <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          <View style={styles.cardMeta}>
            {eq && (
              <View style={styles.metaItem}>
                <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Equipment:</Text>
                <Text style={[styles.metaValue, { color: colors.text }]}>{eq.name}</Text>
              </View>
            )}

            {item.dueDate && (
              <View style={styles.metaItem}>
                <Calendar color={colors.textSecondary} size={12} />
                <Text style={[styles.metaValue, { color: colors.text }]}>{formatDate(item.dueDate)}</Text>
              </View>
            )}
          </View>

          {assignedEmployees && assignedEmployees.length > 0 && (
            <View style={[styles.assignedRow, { borderTopColor: colors.borderLight }]}>
              <Text style={[styles.assignedLabel, { color: colors.textSecondary }]}>Assigned:</Text>
              <Text style={[styles.assignedNames, { color: colors.primary }]} numberOfLines={1}>
                {assignedEmployees.join(', ')}
              </Text>
            </View>
          )}
        </View>

        <ChevronRight color={colors.textSecondary} size={20} />
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Work Orders' }} />

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#F59E0B' + '15' }]}>
          <Clock color="#F59E0B" size={20} />
          <View style={styles.statCardTextCol}>
            <Text style={[styles.statNumber, { color: '#F59E0B' }]} numberOfLines={1}>
              {stats.pending}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>
              Pending
            </Text>
          </View>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#3B82F6' + '15' }]}>
          <ClipboardList color="#3B82F6" size={20} />
          <View style={styles.statCardTextCol}>
            <Text style={[styles.statNumber, { color: '#3B82F6' }]} numberOfLines={1}>
              {stats.inProgress}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>
              Active
            </Text>
          </View>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#10B981' + '15' }]}>
          <CheckCircle2 color="#10B981" size={20} />
          <View style={styles.statCardTextCol}>
            <Text style={[styles.statNumber, { color: '#10B981' }]} numberOfLines={1}>
              {stats.completed}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>
              Done
            </Text>
          </View>
        </View>
        {stats.urgent > 0 ? (
          <View style={[styles.statCard, { backgroundColor: '#DC2626' + '15' }]}>
            <AlertTriangle color="#DC2626" size={20} />
            <View style={styles.statCardTextCol}>
              <Text style={[styles.statNumber, { color: '#DC2626' }]} numberOfLines={1}>
                {stats.urgent}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                Urgent
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterScroll, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}
        contentContainerStyle={styles.filterContainer}
      >
        <Filter color={colors.textSecondary} size={18} />
        <TouchableOpacity
          style={[
            styles.filterButton,
            { backgroundColor: colors.surfaceAlt },
            filterStatus === 'all' && { backgroundColor: colors.primary },
          ]}
          onPress={() => setFilterStatus('all')}
        >
          <Text
            style={[
              styles.filterText,
              { color: colors.textSecondary },
              filterStatus === 'all' && { color: colors.textOnPrimary },
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            { backgroundColor: colors.surfaceAlt },
            filterStatus === 'pending' && { backgroundColor: colors.primary },
          ]}
          onPress={() => setFilterStatus('pending')}
        >
          <Text
            style={[
              styles.filterText,
              { color: colors.textSecondary },
              filterStatus === 'pending' && { color: colors.textOnPrimary },
            ]}
          >
            Pending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            { backgroundColor: colors.surfaceAlt },
            filterStatus === 'in_progress' && { backgroundColor: colors.primary },
          ]}
          onPress={() => setFilterStatus('in_progress')}
        >
          <Text
            style={[
              styles.filterText,
              { color: colors.textSecondary },
              filterStatus === 'in_progress' && { color: colors.textOnPrimary },
            ]}
          >
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            { backgroundColor: colors.surfaceAlt },
            filterStatus === 'completed' && { backgroundColor: colors.primary },
          ]}
          onPress={() => setFilterStatus('completed')}
        >
          <Text
            style={[
              styles.filterText,
              { color: colors.textSecondary },
              filterStatus === 'completed' && { color: colors.textOnPrimary },
            ]}
          >
            Done
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <FlatList
        data={sortedWorkOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderWorkOrderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <ClipboardList color={colors.textSecondary} size={64} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Work Orders</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Create work orders to plan and track future repairs and maintenance tasks
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.accent, shadowColor: colors.accent }]}
        onPress={() => router.push('/workorders/add' as any)}
        activeOpacity={0.8}
      >
        <Plus color={colors.textOnAccent} size={28} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 8,
  },
  statCardTextCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700' as const,
    lineHeight: 24,
  },
  statLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600' as const,
    marginTop: 2,
  },
  filterScroll: { borderBottomWidth: 1, maxHeight: 56 },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    flexGrow: 1,
  },
  filterButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  filterText: { fontSize: 13, fontWeight: '500' as const },
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100 },
  workOrderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  priorityIndicator: { width: 4, alignSelf: 'stretch' },
  cardContent: { flex: 1, padding: 14 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
    minWidth: 0,
  },
  workOrderTitle: { fontSize: 15, fontWeight: '600' as const, flex: 1, minWidth: 0, marginRight: 0 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    maxWidth: '48%',
    minWidth: 0,
    flexShrink: 1,
  },
  statusText: { fontSize: 10, fontWeight: '600' as const, flexShrink: 1, textAlign: 'center' as const },
  description: { fontSize: 13, marginBottom: 8, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaLabel: { fontSize: 12 },
  metaValue: { fontSize: 12, fontWeight: '500' as const },
  assignedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1 },
  assignedLabel: { fontSize: 12, marginRight: 4 },
  assignedNames: { fontSize: 12, fontWeight: '500' as const, flex: 1 },
  emptyState: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '600' as const, marginTop: 20 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});

