import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { 
  Tractor, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Plus,
  Wrench,
  ChevronRight,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFarmData } from '@/contexts/FarmDataContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getMaintenanceStatus, formatHours, formatDate } from '@/utils/helpers';

export default function DashboardScreen() {
  const router = useRouter();
  const { equipment, maintenanceLogs, intervals, isLoading } = useFarmData();
  const { colors } = useTheme();

  const stats = useMemo(() => {
    let dueCount = 0;
    let overdueCount = 0;
    let okCount = 0;

    equipment.forEach(eq => {
      const eqIntervals = intervals.filter(i => i.equipmentId === eq.id);
      let worstStatus = 'ok' as 'ok' | 'due' | 'overdue';

      eqIntervals.forEach(interval => {
        const status = getMaintenanceStatus(
          interval.lastPerformedHours,
          eq.currentHours,
          interval.intervalHours,
          interval.lastPerformedDate,
          interval.intervalDays
        );
        if (status === 'overdue') worstStatus = 'overdue';
        else if (status === 'due' && worstStatus === 'ok') worstStatus = 'due';
      });

      if (worstStatus === 'overdue') overdueCount++;
      else if (worstStatus === 'due') dueCount++;
      else okCount++;
    });

    return { dueCount, overdueCount, okCount, total: equipment.length };
  }, [equipment, intervals]);

  const upcomingMaintenance = useMemo(() => {
    const items: { equipment: typeof equipment[0]; interval: typeof intervals[0]; status: 'due' | 'overdue' }[] = [];

    equipment.forEach(eq => {
      const eqIntervals = intervals.filter(i => i.equipmentId === eq.id);
      eqIntervals.forEach(interval => {
        const status = getMaintenanceStatus(
          interval.lastPerformedHours,
          eq.currentHours,
          interval.intervalHours,
          interval.lastPerformedDate,
          interval.intervalDays
        );
        if (status === 'due' || status === 'overdue') {
          items.push({ equipment: eq, interval, status });
        }
      });
    });

    return items.sort((a, b) => (a.status === 'overdue' ? -1 : 1)).slice(0, 5);
  }, [equipment, intervals]);

  const recentLogs = useMemo(() => {
    return [...maintenanceLogs]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [maintenanceLogs]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={[colors.primary, colors.primaryLight]}
        style={styles.header}
      >
        <Text style={[styles.headerTitle, { color: colors.textOnPrimary }]}>FarmGuard</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textOnPrimary }]}>Equipment Maintenance</Text>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.statusOk + '15' }]}
            onPress={() => router.push('/equipment' as any)}
          >
            <CheckCircle color={colors.statusOk} size={28} />
            <Text style={[styles.statNumber, { color: colors.statusOk }]}>{stats.okCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Good</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.statusDue + '15' }]}
            onPress={() => router.push('/equipment' as any)}
          >
            <Clock color={colors.statusDue} size={28} />
            <Text style={[styles.statNumber, { color: colors.statusDue }]}>{stats.dueCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Due Soon</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.statusOverdue + '15' }]}
            onPress={() => router.push('/equipment' as any)}
          >
            <AlertTriangle color={colors.statusOverdue} size={28} />
            <Text style={[styles.statNumber, { color: colors.statusOverdue }]}>{stats.overdueCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Overdue</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface, shadowColor: colors.cardShadow }]}
            onPress={() => router.push('/equipment?showAddMenu=true' as any)}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: colors.primary }]}>
              <Plus color={colors.textOnPrimary} size={20} />
            </View>
            <Text style={[styles.actionText, { color: colors.text }]}>Add Equipment</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface, shadowColor: colors.cardShadow }]}
            onPress={() => router.push('/maintenance/add' as any)}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: colors.accent }]}>
              <Wrench color={colors.textOnPrimary} size={20} />
            </View>
            <Text style={[styles.actionText, { color: colors.text }]}>Log Service</Text>
          </TouchableOpacity>
        </View>

        {upcomingMaintenance.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Attention Required</Text>
            {upcomingMaintenance.map((item, index) => (
              <TouchableOpacity
                key={`${item.equipment.id}-${item.interval.id}-${index}`}
                style={[styles.alertCard, { backgroundColor: colors.surface, shadowColor: colors.cardShadow }]}
                onPress={() => router.push(`/equipment/${item.equipment.id}` as any)}
              >
                <View style={[
                  styles.alertIndicator,
                  { backgroundColor: item.status === 'overdue' ? colors.statusOverdue : colors.statusDue }
                ]} />
                <View style={styles.alertContent}>
                  <Text style={[styles.alertTitle, { color: colors.text }]}>{item.interval.name}</Text>
                  <Text style={[styles.alertSubtitle, { color: colors.textSecondary }]}>{item.equipment.name}</Text>
                  {item.interval.intervalHours && (
                    <Text style={[styles.alertMeta, { color: colors.textSecondary }]}>
                      Current: {formatHours(item.equipment.currentHours)} • 
                      Due at: {formatHours((item.interval.lastPerformedHours ?? 0) + item.interval.intervalHours)}
                    </Text>
                  )}
                </View>
                <ChevronRight color={colors.textSecondary} size={20} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {recentLogs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Services</Text>
              <TouchableOpacity onPress={() => router.push('/maintenance' as any)}>
                <Text style={[styles.seeAllText, { color: colors.primary }]}>See All</Text>
              </TouchableOpacity>
            </View>
            {recentLogs.map((log) => {
              const eq = equipment.find(e => e.id === log.equipmentId);
              return (
                <TouchableOpacity
                  key={log.id}
                  style={[styles.logCard, { backgroundColor: colors.surface }]}
                  onPress={() => router.push(`/maintenance/${log.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.logIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Wrench color={colors.primary} size={18} />
                  </View>
                  <View style={styles.logContent}>
                    <Text style={[styles.logTitle, { color: colors.text }]}>{log.description}</Text>
                    <Text style={[styles.logSubtitle, { color: colors.textSecondary }]}>{eq?.name ?? 'Unknown'}</Text>
                  </View>
                  <Text style={[styles.logDate, { color: colors.textSecondary }]}>{formatDate(log.date)}</Text>
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
          </View>
        )}
      </View>
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
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
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
  content: {
    padding: 16,
    marginTop: -10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700' as const,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 68,
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600' as const,
    flexShrink: 1,
    flexWrap: 'wrap',
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
    fontSize: 18,
    fontWeight: '600' as const,
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  alertIndicator: {
    width: 4,
    height: 44,
    borderRadius: 2,
    marginRight: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
  },
  alertSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  alertMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  logCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  logIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logContent: {
    flex: 1,
  },
  logTitle: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  logSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  logDate: {
    fontSize: 12,
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
