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
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { getMaintenanceStatus, formatHours, formatDate } from '@/utils/helpers';

export default function DashboardScreen() {
  const router = useRouter();
  const { equipment, maintenanceLogs, intervals, isLoading } = useFarmData();

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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryLight]}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>FarmGuard</Text>
        <Text style={styles.headerSubtitle}>Equipment Maintenance</Text>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: Colors.statusOk + '15' }]}
            onPress={() => router.push('/equipment' as any)}
          >
            <CheckCircle color={Colors.statusOk} size={28} />
            <Text style={[styles.statNumber, { color: Colors.statusOk }]}>{stats.okCount}</Text>
            <Text style={styles.statLabel}>Good</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: Colors.statusDue + '15' }]}
            onPress={() => router.push('/equipment' as any)}
          >
            <Clock color={Colors.statusDue} size={28} />
            <Text style={[styles.statNumber, { color: Colors.statusDue }]}>{stats.dueCount}</Text>
            <Text style={styles.statLabel}>Due Soon</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: Colors.statusOverdue + '15' }]}
            onPress={() => router.push('/equipment' as any)}
          >
            <AlertTriangle color={Colors.statusOverdue} size={28} />
            <Text style={[styles.statNumber, { color: Colors.statusOverdue }]}>{stats.overdueCount}</Text>
            <Text style={styles.statLabel}>Overdue</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/equipment?showAddMenu=true' as any)}
          >
            <View style={styles.actionIconContainer}>
              <Plus color={Colors.textOnPrimary} size={20} />
            </View>
            <Text style={styles.actionText}>Add Equipment</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/maintenance/add' as any)}
          >
            <View style={[styles.actionIconContainer, { backgroundColor: Colors.accent }]}>
              <Wrench color={Colors.textOnPrimary} size={20} />
            </View>
            <Text style={styles.actionText}>Log Service</Text>
          </TouchableOpacity>
        </View>

        {upcomingMaintenance.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Attention Required</Text>
            {upcomingMaintenance.map((item, index) => (
              <TouchableOpacity
                key={`${item.equipment.id}-${item.interval.id}-${index}`}
                style={styles.alertCard}
                onPress={() => router.push(`/equipment/${item.equipment.id}` as any)}
              >
                <View style={[
                  styles.alertIndicator,
                  { backgroundColor: item.status === 'overdue' ? Colors.statusOverdue : Colors.statusDue }
                ]} />
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>{item.interval.name}</Text>
                  <Text style={styles.alertSubtitle}>{item.equipment.name}</Text>
                  {item.interval.intervalHours && (
                    <Text style={styles.alertMeta}>
                      Current: {formatHours(item.equipment.currentHours)} • 
                      Due at: {formatHours((item.interval.lastPerformedHours ?? 0) + item.interval.intervalHours)}
                    </Text>
                  )}
                </View>
                <ChevronRight color={Colors.textSecondary} size={20} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {recentLogs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Services</Text>
              <TouchableOpacity onPress={() => router.push('/maintenance' as any)}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            {recentLogs.map((log) => {
              const eq = equipment.find(e => e.id === log.equipmentId);
              return (
                <View key={log.id} style={styles.logCard}>
                  <View style={styles.logIcon}>
                    <Wrench color={Colors.primary} size={18} />
                  </View>
                  <View style={styles.logContent}>
                    <Text style={styles.logTitle}>{log.description}</Text>
                    <Text style={styles.logSubtitle}>{eq?.name ?? 'Unknown'}</Text>
                  </View>
                  <Text style={styles.logDate}>{formatDate(log.date)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {equipment.length === 0 && (
          <View style={styles.emptyState}>
            <Tractor color={Colors.textSecondary} size={64} />
            <Text style={styles.emptyTitle}>No Equipment Yet</Text>
            <Text style={styles.emptySubtitle}>
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
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
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
    color: Colors.textOnPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textOnPrimary,
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
    color: Colors.textSecondary,
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
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 10,
    shadowColor: Colors.cardShadow,
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
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
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
    color: Colors.text,
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: Colors.cardShadow,
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
    color: Colors.text,
  },
  alertSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  alertMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  logCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  logIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.primary + '15',
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
    color: Colors.text,
  },
  logSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  logDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
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
  
});
