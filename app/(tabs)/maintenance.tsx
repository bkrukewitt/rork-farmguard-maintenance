import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { 
  Plus, 
  Wrench, 
  AlertCircle,
  ClipboardCheck,
  Filter,
  Calendar,
  X,
  ClipboardList,
  Search,
  FileText,
} from 'lucide-react-native';
import { useFarmData } from '@/contexts/FarmDataContext';
import { useTheme } from '@/contexts/ThemeContext';
import { MaintenanceLog } from '@/types/equipment';
import { formatDate, formatHours } from '@/utils/helpers';

type FilterType = 'all' | 'routine' | 'repair' | 'inspection';

export default function MaintenanceScreen() {
  const router = useRouter();
  const { maintenanceLogs, equipment, isLoading } = useFarmData();
  const { colors } = useTheme();
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showAddMenu, setShowAddMenu] = useState(false);

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
        return colors.statusOverdue;
      case 'inspection':
        return colors.accent;
      default:
        return colors.primary;
    }
  };

  const renderLogItem = ({ item }: { item: MaintenanceLog }) => {
    const eq = equipment.find(e => e.id === item.equipmentId);
    const Icon = getTypeIcon(item.type);
    const typeColor = getTypeColor(item.type);

    return (
      <TouchableOpacity
        style={[styles.logCard, { backgroundColor: colors.surface, shadowColor: colors.cardShadow }]}
        onPress={() => router.push(`/maintenance/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={[styles.logIconContainer, { backgroundColor: typeColor + '15' }]}>
          <Icon color={typeColor} size={22} />
        </View>
        
        <View style={styles.logContent}>
          <Text style={[styles.logDescription, { color: colors.text }]} numberOfLines={2}>{item.description}</Text>
          <Text style={[styles.logEquipment, { color: colors.textSecondary }]}>{eq?.name ?? 'Unknown Equipment'}</Text>
          <View style={styles.logMeta}>
            <Text style={[styles.logMetaText, { color: colors.primary }]}>{formatHours(item.hoursAtService)}</Text>
          </View>
        </View>
        
        <View style={styles.logRight}>
          <Text style={[styles.logDate, { color: colors.textSecondary }]}>{formatDate(item.date)}</Text>
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
      <Calendar color={colors.textSecondary} size={16} />
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.filterContainer, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <Filter color={colors.textSecondary} size={18} />
        <TouchableOpacity
          style={[styles.filterButton, { backgroundColor: colors.surfaceAlt }, filterType === 'all' && { backgroundColor: colors.primary }]}
          onPress={() => setFilterType('all')}
        >
          <Text style={[styles.filterText, { color: colors.textSecondary }, filterType === 'all' && { color: colors.textOnPrimary }]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, { backgroundColor: colors.surfaceAlt }, filterType === 'routine' && { backgroundColor: colors.primary }]}
          onPress={() => setFilterType('routine')}
        >
          <Text style={[styles.filterText, { color: colors.textSecondary }, filterType === 'routine' && { color: colors.textOnPrimary }]}>
            Routine
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, { backgroundColor: colors.surfaceAlt }, filterType === 'repair' && { backgroundColor: colors.primary }]}
          onPress={() => setFilterType('repair')}
        >
          <Text style={[styles.filterText, { color: colors.textSecondary }, filterType === 'repair' && { color: colors.textOnPrimary }]}>
            Repairs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, { backgroundColor: colors.surfaceAlt }, filterType === 'inspection' && { backgroundColor: colors.primary }]}
          onPress={() => setFilterType('inspection')}
        >
          <Text style={[styles.filterText, { color: colors.textSecondary }, filterType === 'inspection' && { color: colors.textOnPrimary }]}>
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
            <Wrench color={colors.textSecondary} size={64} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Maintenance Logs</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Start logging your equipment maintenance to track history
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.accent, shadowColor: colors.accent }]}
        onPress={() => setShowAddMenu(true)}
        activeOpacity={0.8}
      >
        <Plus color={colors.textOnAccent} size={28} />
      </TouchableOpacity>

      <Modal
        visible={showAddMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddMenu(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setShowAddMenu(false)}
        >
          <Pressable style={[styles.menuContainer, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.menuHeader, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Add New</Text>
              <TouchableOpacity onPress={() => setShowAddMenu(false)}>
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.borderLight }]}
              onPress={() => {
                setShowAddMenu(false);
                router.push('/maintenance/add' as any);
              }}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: colors.primary + '15' }]}>
                <Wrench color={colors.primary} size={22} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>Log Maintenance</Text>
                <Text style={[styles.menuItemSubtitle, { color: colors.textSecondary }]}>Record service, repair, or inspection</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.borderLight }]}
              onPress={() => {
                setShowAddMenu(false);
                router.push('/routines/service' as any);
              }}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: colors.accent + '15' }]}>
                <ClipboardList color={colors.accent} size={22} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>Service Routines</Text>
                <Text style={[styles.menuItemSubtitle, { color: colors.textSecondary }]}>Manage reusable service checklists</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, { borderBottomColor: colors.borderLight }]}
              onPress={() => {
                setShowAddMenu(false);
                router.push('/routines/inspection' as any);
              }}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#8B5CF6' + '15' }]}>
                <Search color="#8B5CF6" size={22} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>Inspection Routines</Text>
                <Text style={[styles.menuItemSubtitle, { color: colors.textSecondary }]}>Manage inspection checklists</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, { borderBottomWidth: 0 }]}
              onPress={() => {
                setShowAddMenu(false);
                router.push('/workorders' as any);
              }}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#F59E0B' + '15' }]}>
                <FileText color="#F59E0B" size={22} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>Work Orders</Text>
                <Text style={[styles.menuItemSubtitle, { color: colors.textSecondary }]}>Plan and assign future tasks</Text>
              </View>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
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
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500' as const,
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
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  logCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
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
    marginBottom: 4,
  },
  logEquipment: {
    fontSize: 13,
    marginBottom: 6,
  },
  logMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logMetaText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  logRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginLeft: 8,
  },
  logDate: {
    fontSize: 12,
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
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 14,
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
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  menuIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 13,
  },
});
