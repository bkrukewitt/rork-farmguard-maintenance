import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { 
  Tractor, 
  Plus,
  Wrench,
  ChevronRight,
  ClipboardList,
  FileText,
  AlertTriangle,
  BarChart3,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFarmData } from '@/contexts/FarmDataContext';
import { useTheme } from '@/contexts/ThemeContext';
import { usePurchases } from '@/contexts/PurchasesContext';
import PaywallModal from '@/components/PaywallModal';
import { formatDate, formatMetric } from '@/utils/helpers';

export default function DashboardScreen() {
  const router = useRouter();
  const { equipment, maintenanceLogs, workOrders, employees, isLoading, refreshData, deviceId, getLowStockConsumables } = useFarmData();
  const [refreshing, setRefreshing] = useState(false);
  const { isTrial, isSubscribed } = usePurchases();
  const [showPaywall, setShowPaywall] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
    }
  }, [refreshData]);
  const { colors } = useTheme();

  const handleTrialAction = useCallback(() => {
    setShowPaywall(true);
  }, []);

  const myWorkOrders = useMemo(() => {
    const linkedEmployee = employees.find(e => e.linkedDeviceId === deviceId);
    if (!linkedEmployee) return [];
    return workOrders
      .filter(wo => wo.assignedTo?.includes(linkedEmployee.id) && wo.status !== 'completed' && wo.status !== 'cancelled')
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
      })
      .slice(0, 5);
  }, [workOrders, employees, deviceId]);

  const activeWorkOrders = useMemo(() => {
    return workOrders.filter(wo => wo.status !== 'completed' && wo.status !== 'cancelled');
  }, [workOrders]);

  const lowStockParts = useMemo(() => getLowStockConsumables(), [getLowStockConsumables]);

  const recentActivity = useMemo(() => {
    const logItems = maintenanceLogs.map(log => ({
      id: log.id,
      type: 'log' as const,
      title: log.description,
      subtitle: equipment.find(e => e.id === log.equipmentId)?.name ?? 'Unknown',
      date: log.date,
      logType: log.type,
    }));

    const completedWOs = workOrders
      .filter(wo => wo.status === 'completed' && wo.completedAt)
      .map(wo => ({
        id: wo.id,
        type: 'workorder' as const,
        title: wo.title,
        subtitle: equipment.find(e => e.id === wo.equipmentId)?.name ?? 'Work Order',
        date: wo.completedAt!,
        logType: 'workorder' as const,
      }));

    return [...logItems, ...completedWOs]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }, [maintenanceLogs, workOrders, equipment]);

  const topEquipment = useMemo(() => {
    return [...equipment]
      .sort((a, b) => b.currentHours - a.currentHours)
      .slice(0, 3);
  }, [equipment]);

  const monthlyLogCount = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return maintenanceLogs.filter(l => new Date(l.date) >= startOfMonth).length;
  }, [maintenanceLogs]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#DC2626';
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'repair': return { icon: AlertTriangle, color: colors.statusOverdue };
      case 'inspection': return { icon: ClipboardList, color: colors.accent };
      case 'workorder': return { icon: FileText, color: '#3B82F6' };
      default: return { icon: Wrench, color: colors.primary };
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <LinearGradient
        colors={[colors.primary, colors.primaryLight]}
        style={styles.header}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.textOnPrimary }]}>FarmGuard</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textOnPrimary }]}>Equipment Maintenance</Text>
          </View>
          {isTrial && !isSubscribed && (
            <View style={styles.trialBadge}>
              <Text style={styles.trialBadgeText}>PREVIEW</Text>
            </View>
          )}
        </View>

        <View style={styles.headerStats}>
          <View style={styles.headerStatItem}>
            <Text style={[styles.headerStatNumber, { color: colors.textOnPrimary }]}>{equipment.length}</Text>
            <Text style={[styles.headerStatLabel, { color: colors.textOnPrimary }]}>Equipment</Text>
          </View>
          <View style={[styles.headerStatDivider, { backgroundColor: colors.textOnPrimary + '30' }]} />
          <View style={styles.headerStatItem}>
            <Text style={[styles.headerStatNumber, { color: colors.textOnPrimary }]}>{monthlyLogCount}</Text>
            <Text style={[styles.headerStatLabel, { color: colors.textOnPrimary }]}>Services This Month</Text>
          </View>
          <View style={[styles.headerStatDivider, { backgroundColor: colors.textOnPrimary + '30' }]} />
          <View style={styles.headerStatItem}>
            <Text style={[styles.headerStatNumber, { color: colors.textOnPrimary }]}>{activeWorkOrders.length}</Text>
            <Text style={[styles.headerStatLabel, { color: colors.textOnPrimary }]}>Open Orders</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface, shadowColor: colors.cardShadow }]}
            onPress={() => isTrial && !isSubscribed ? handleTrialAction() : router.push('/equipment?showAddMenu=true' as any)}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: colors.primary }]}>
              <Plus color={colors.textOnPrimary} size={20} />
            </View>
            <Text style={[styles.actionText, { color: colors.text }]}>Add Equipment</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface, shadowColor: colors.cardShadow }]}
            onPress={() => isTrial && !isSubscribed ? handleTrialAction() : router.push('/maintenance/add' as any)}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: colors.accent }]}>
              <Wrench color={colors.textOnAccent} size={20} />
            </View>
            <Text style={[styles.actionText, { color: colors.text }]}>Log Service</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface, shadowColor: colors.cardShadow }]}
            onPress={() => isTrial && !isSubscribed ? handleTrialAction() : router.push('/workorders/add' as any)}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: '#3B82F6' }]}>
              <FileText color="#FFFFFF" size={20} />
            </View>
            <Text style={[styles.actionText, { color: colors.text }]}>Work Order</Text>
          </TouchableOpacity>
        </View>

        {myWorkOrders.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>My Work Orders</Text>
              <TouchableOpacity onPress={() => router.push('/workorders' as any)}>
                <Text style={[styles.seeAllText, { color: colors.primary }]}>See All</Text>
              </TouchableOpacity>
            </View>
            {myWorkOrders.map((wo) => (
              <TouchableOpacity
                key={wo.id}
                style={[styles.workOrderCard, { backgroundColor: colors.surface, shadowColor: colors.cardShadow }]}
                onPress={() => router.push(`/workorders/${wo.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.woPriorityBar, { backgroundColor: getPriorityColor(wo.priority) }]} />
                <View style={styles.woContent}>
                  <Text style={[styles.woTitle, { color: colors.text }]} numberOfLines={1}>{wo.title}</Text>
                  <View style={styles.woMeta}>
                    <View style={[styles.woStatusBadge, { backgroundColor: wo.status === 'in_progress' ? '#3B82F620' : '#F59E0B20' }]}>
                      <Text style={[styles.woStatusText, { color: wo.status === 'in_progress' ? '#3B82F6' : '#F59E0B' }]}>
                        {wo.status === 'in_progress' ? 'In Progress' : 'Pending'}
                      </Text>
                    </View>
                    {wo.dueDate && (
                      <Text style={[styles.woDate, { color: colors.textSecondary }]}>{formatDate(wo.dueDate)}</Text>
                    )}
                  </View>
                </View>
                <ChevronRight color={colors.textSecondary} size={18} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {lowStockParts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Low Stock Alerts</Text>
              <TouchableOpacity onPress={() => router.push('/inventory' as any)}>
                <Text style={[styles.seeAllText, { color: colors.primary }]}>View Inventory</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.lowStockContainer, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B30' }]}>
              <AlertTriangle color="#F59E0B" size={18} />
              <View style={styles.lowStockContent}>
                <Text style={[styles.lowStockTitle, { color: '#92400E' }]}>
                  {lowStockParts.length} part{lowStockParts.length > 1 ? 's' : ''} running low
                </Text>
                <Text style={[styles.lowStockNames, { color: '#A16207' }]} numberOfLines={2}>
                  {lowStockParts.map(p => p.name).join(', ')}
                </Text>
              </View>
            </View>
          </View>
        )}

        {topEquipment.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Fleet Overview</Text>
              <TouchableOpacity onPress={() => router.push('/equipment' as any)}>
                <Text style={[styles.seeAllText, { color: colors.primary }]}>All Equipment</Text>
              </TouchableOpacity>
            </View>
            {topEquipment.map((eq) => {
              const eqLogCount = maintenanceLogs.filter(l => l.equipmentId === eq.id).length;
              return (
                <TouchableOpacity
                  key={eq.id}
                  style={[styles.equipmentCard, { backgroundColor: colors.surface, shadowColor: colors.cardShadow }]}
                  onPress={() => router.push(`/equipment/${eq.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.equipmentIcon, { backgroundColor: colors.primary + '12' }]}>
                    <Tractor color={colors.primary} size={22} />
                  </View>
                  <View style={styles.equipmentInfo}>
                    <Text style={[styles.equipmentName, { color: colors.text }]} numberOfLines={1}>{eq.name}</Text>
                    <Text style={[styles.equipmentMeta, { color: colors.textSecondary }]}>
                      {formatMetric(eq.currentHours, eq.metric)} • {eqLogCount} service{eqLogCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View style={styles.equipmentHoursContainer}>
                    <BarChart3 color={colors.textSecondary} size={14} />
                    <Text style={[styles.equipmentHours, { color: colors.textSecondary }]}>
                      {formatMetric(eq.currentHours, eq.metric)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {recentActivity.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Activity</Text>
              <TouchableOpacity onPress={() => router.push('/maintenance' as any)}>
                <Text style={[styles.seeAllText, { color: colors.primary }]}>See All</Text>
              </TouchableOpacity>
            </View>
            {recentActivity.map((item) => {
              const { icon: Icon, color: iconColor } = getActivityIcon(item.logType);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.activityCard, { backgroundColor: colors.surface }]}
                  onPress={() => router.push(
                    item.type === 'workorder' ? `/workorders/${item.id}` as any : `/maintenance/${item.id}` as any
                  )}
                  activeOpacity={0.7}
                >
                  <View style={[styles.activityIcon, { backgroundColor: iconColor + '15' }]}>
                    <Icon color={iconColor} size={16} />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={[styles.activityTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={[styles.activitySubtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
                  </View>
                  <Text style={[styles.activityDate, { color: colors.textSecondary }]}>{formatDate(item.date)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {equipment.length === 0 && (
          <View style={styles.emptyState}>
            <Tractor color={colors.textSecondary} size={64} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Equipment Yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Add your first piece of equipment to start tracking maintenance
            </Text>
            {isTrial && !isSubscribed && (
              <Text style={[styles.emptySubtitle, { color: colors.primary, marginTop: 12, fontWeight: '500' as const }]}>
                Subscribe to start adding equipment
              </Text>
            )}
          </View>
        )}
      </View>
      <PaywallModal visible={showPaywall} onDismiss={() => setShowPaywall(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
  },
  trialBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  trialBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  headerStats: {
    flexDirection: 'row',
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  headerStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  headerStatNumber: {
    fontSize: 22,
    fontWeight: '700' as const,
  },
  headerStatLabel: {
    fontSize: 11,
    opacity: 0.75,
    marginTop: 2,
  },
  headerStatDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: 4,
  },
  content: {
    padding: 16,
    marginTop: -6,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  actionIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 11,
    fontWeight: '600' as const,
    textAlign: 'center',
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
    fontSize: 17,
    fontWeight: '600' as const,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  workOrderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  woPriorityBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  woContent: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  woTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 6,
  },
  woMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  woStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  woStatusText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  woDate: {
    fontSize: 11,
  },
  lowStockContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  lowStockContent: {
    flex: 1,
  },
  lowStockTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  lowStockNames: {
    fontSize: 12,
    lineHeight: 17,
  },
  equipmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  equipmentIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  equipmentInfo: {
    flex: 1,
  },
  equipmentName: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  equipmentMeta: {
    fontSize: 12,
  },
  equipmentHoursContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  equipmentHours: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  activityIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  activitySubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  activityDate: {
    fontSize: 11,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
