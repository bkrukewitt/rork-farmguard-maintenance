import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { 
  Plus, 
  Wrench, 
  AlertCircle,
  ClipboardCheck,
  Filter,
  Calendar,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { MaintenanceLog } from '@/types/equipment';
import { formatDate, formatHours, formatCurrency } from '@/utils/helpers';

type FilterType = 'all' | 'routine' | 'repair' | 'inspection';

export default function MaintenanceScreen() {
  const router = useRouter();
  const { maintenanceLogs, equipment, isLoading } = useFarmData();
  const [filterType, setFilterType] = useState<FilterType>('all');

  const sortedLogs = useMemo(() => {
    let logs = [...maintenanceLogs].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    if (filterType !== 'all') {
      logs = logs.filter(log => log.type === filterType);
    }
    
    return logs;
  }, [maintenanceLogs, filterType]);

  const groupedLogs = useMemo(() => {
    const groups: { [key: string]: MaintenanceLog[] } = {};
    
    sortedLogs.forEach(log => {
      const date = new Date(log.date);
      const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(log);
    });
    
    return Object.entries(groups);
  }, [sortedLogs]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'repair':
        return AlertCircle;
      case 'inspection':
        return ClipboardCheck;
      default:
        return Wrench;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'repair':
        return Colors.statusOverdue;
      case 'inspection':
        return Colors.accent;
      default:
        return Colors.primary;
    }
  };

  const renderLogItem = ({ item }: { item: MaintenanceLog }) => {
    const eq = equipment.find(e => e.id === item.equipmentId);
    const Icon = getTypeIcon(item.type);
    const typeColor = getTypeColor(item.type);

    return (
      <TouchableOpacity
        style={styles.logCard}
        onPress={() => router.push(`/equipment/${item.equipmentId}`)}
        activeOpacity={0.7}
      >
        <View style={[styles.logIconContainer, { backgroundColor: typeColor + '15' }]}>
          <Icon color={typeColor} size={22} />
        </View>
        
        <View style={styles.logContent}>
          <Text style={styles.logDescription} numberOfLines={2}>{item.description}</Text>
          <Text style={styles.logEquipment}>{eq?.name ?? 'Unknown Equipment'}</Text>
          <View style={styles.logMeta}>
            <Text style={styles.logMetaText}>{formatHours(item.hoursAtService)}</Text>
            {item.cost > 0 && (
              <Text style={styles.logCost}>{formatCurrency(item.cost)}</Text>
            )}
          </View>
        </View>
        
        <View style={styles.logRight}>
          <Text style={styles.logDate}>{formatDate(item.date)}</Text>
          <View style={[styles.typeBadge, { backgroundColor: typeColor + '20' }]}>
            <Text style={[styles.typeBadgeText, { color: typeColor }]}>
              {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Calendar color={Colors.textSecondary} size={16} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterContainer}>
        <Filter color={Colors.textSecondary} size={18} />
        <TouchableOpacity
          style={[styles.filterButton, filterType === 'all' && styles.filterButtonActive]}
          onPress={() => setFilterType('all')}
        >
          <Text style={[styles.filterText, filterType === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filterType === 'routine' && styles.filterButtonActive]}
          onPress={() => setFilterType('routine')}
        >
          <Text style={[styles.filterText, filterType === 'routine' && styles.filterTextActive]}>
            Routine
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filterType === 'repair' && styles.filterButtonActive]}
          onPress={() => setFilterType('repair')}
        >
          <Text style={[styles.filterText, filterType === 'repair' && styles.filterTextActive]}>
            Repairs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filterType === 'inspection' && styles.filterButtonActive]}
          onPress={() => setFilterType('inspection')}
        >
          <Text style={[styles.filterText, filterType === 'inspection' && styles.filterTextActive]}>
            Inspections
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={groupedLogs}
        keyExtractor={([title]) => title}
        renderItem={({ item: [title, logs] }) => (
          <View>
            {renderSectionHeader(title)}
            {logs.map(log => (
              <View key={log.id}>
                {renderLogItem({ item: log })}
              </View>
            ))}
          </View>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Wrench color={Colors.textSecondary} size={64} />
            <Text style={styles.emptyTitle}>No Maintenance Logs</Text>
            <Text style={styles.emptySubtitle}>
              Start logging your equipment maintenance to track history
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/maintenance/add')}
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
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  logIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logContent: {
    flex: 1,
  },
  logDescription: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  logEquipment: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  logMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logMetaText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  logCost: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '500' as const,
  },
  logRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginLeft: 8,
  },
  logDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
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
