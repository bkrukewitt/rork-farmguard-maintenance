import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  TextInput,
  ScrollView,
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
  ChevronDown,
  Fuel,
} from 'lucide-react-native';
import { useFarmData } from '@/contexts/FarmDataContext';
import { useTheme } from '@/contexts/ThemeContext';
import { formatDate, formatHours } from '@/utils/helpers';

type FilterType = 'all' | 'routine' | 'repair' | 'inspection' | 'workorder' | 'fuel';
interface CombinedLogItem {
  id: string;
  type: 'log' | 'workorder' | 'fuel';
  date: string;
  title: string;
  subtitle: string;
  logType: string;
  equipmentId?: string;
  hoursAtService?: number;
  priority?: string;
  status?: string;
  gallons?: number;
  defGallons?: number;
}

export default function MaintenanceScreen() {
  const router = useRouter();
  const { maintenanceLogs, workOrders, equipment, fuelLogs, isLoading, refreshData } = useFarmData();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
    }
  }, [refreshData]);
  const { colors } = useTheme();
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortType] = useState<'newest' | 'oldest'>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [selectedEquipmentFilter, setSelectedEquipmentFilter] = useState<string>('all');
  const [showEquipmentFilter, setShowEquipmentFilter] = useState(false);

  const combinedItems = useMemo(() => {
    const logItems: CombinedLogItem[] = maintenanceLogs.map(log => ({
      id: log.id,
      type: 'log' as const,
      date: log.date,
      title: log.description,
      subtitle: equipment.find(e => e.id === log.equipmentId)?.name ?? 'Unknown Equipment',
      logType: log.type,
      equipmentId: log.equipmentId,
      hoursAtService: log.hoursAtService,
    }));

    const completedWorkOrders: CombinedLogItem[] = workOrders
      .filter(wo => wo.status === 'completed')
      .map(wo => ({
        id: wo.id,
        type: 'workorder' as const,
        date: wo.completedAt ?? wo.updatedAt,
        title: wo.title,
        subtitle: equipment.find(e => e.id === wo.equipmentId)?.name ?? 'Work Order',
        logType: 'workorder',
        equipmentId: wo.equipmentId,
        priority: wo.priority,
        status: wo.status,
      }));

    const fuelItems: CombinedLogItem[] = fuelLogs.map(fl => {
      const fuelTypeName = fl.fuelType === 'custom' && fl.customFuelTypeName
        ? fl.customFuelTypeName
        : fl.fuelType === 'off_road_diesel' ? 'Off-Road Diesel'
        : fl.fuelType === 'on_road_diesel' ? 'On-Road Diesel'
        : fl.fuelType === 'gasoline' ? 'Gasoline' : fl.fuelType;
      return {
        id: fl.id,
        type: 'fuel' as const,
        date: fl.date,
        title: `${fl.gallons} gal ${fuelTypeName}${fl.defGallons ? ` + ${fl.defGallons} gal DEF` : ''}`,
        subtitle: equipment.find(e => e.id === fl.equipmentId)?.name ?? 'Unknown Equipment',
        logType: 'fuel',
        equipmentId: fl.equipmentId,
        hoursAtService: fl.hoursAtFillUp,
        gallons: fl.gallons,
        defGallons: fl.defGallons,
      };
    });

    let items = [...logItems, ...completedWorkOrders, ...fuelItems];

    if (filterType !== 'all') {
      if (filterType === 'workorder') {
        items = items.filter(item => item.type === 'workorder');
      } else if (filterType === 'fuel') {
        items = items.filter(item => item.type === 'fuel');
      } else {
        items = items.filter(item => item.type === 'log' && item.logType === filterType);
      }
    }

    if (selectedEquipmentFilter !== 'all') {
      items = items.filter(item => item.equipmentId === selectedEquipmentFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q)
      );
    }

    items.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortType === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return items;
  }, [maintenanceLogs, workOrders, fuelLogs, equipment, filterType, sortType, searchQuery, selectedEquipmentFilter]);

  const groupedItems = useMemo(() => {
    const groups: { [key: string]: CombinedLogItem[] } = {};
    
    combinedItems.forEach(item => {
      const date = new Date(item.date);
      const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(item);
    });
    
    return Object.entries(groups);
  }, [combinedItems]);

  const getTypeIcon = (item: CombinedLogItem) => {
    if (item.type === 'workorder') return FileText;
    if (item.type === 'fuel') return Fuel;
    switch (item.logType) {
      case 'repair':
        return AlertCircle;
      case 'inspection':
        return ClipboardCheck;
      default:
        return Wrench;
    }
  };

  const getTypeColor = (item: CombinedLogItem) => {
    if (item.type === 'workorder') return '#3B82F6';
    if (item.type === 'fuel') return '#059669';
    switch (item.logType) {
      case 'repair':
        return colors.statusOverdue;
      case 'inspection':
        return colors.accent;
      default:
        return colors.primary;
    }
  };

  const getTypeLabel = (item: CombinedLogItem) => {
    if (item.type === 'workorder') return 'Work Order';
    if (item.type === 'fuel') return 'Fuel';
    return item.logType.charAt(0).toUpperCase() + item.logType.slice(1);
  };

  const selectedEquipmentName = useMemo(() => {
    if (selectedEquipmentFilter === 'all') return 'All Equipment';
    return equipment.find(e => e.id === selectedEquipmentFilter)?.name ?? 'Unknown';
  }, [selectedEquipmentFilter, equipment]);

  const renderLogItem = (item: CombinedLogItem) => {
    const Icon = getTypeIcon(item);
    const typeColor = getTypeColor(item);

    return (
      <TouchableOpacity
        style={[styles.logCard, { backgroundColor: colors.surface, shadowColor: colors.cardShadow }]}
        onPress={() => {
          if (item.type === 'workorder') {
            router.push(`/workorders/${item.id}` as any);
          } else {
            router.push(`/maintenance/${item.id}` as any);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.logIconContainer, { backgroundColor: typeColor + '15' }]}>
          <Icon color={typeColor} size={22} />
        </View>
        
        <View style={styles.logContent}>
          <Text style={[styles.logDescription, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
          <Text style={[styles.logEquipment, { color: colors.textSecondary }]}>{item.subtitle}</Text>
          {item.hoursAtService !== undefined && item.hoursAtService > 0 && (
            <View style={styles.logMeta}>
              <Text style={[styles.logMetaText, { color: colors.primary }]}>{formatHours(item.hoursAtService)}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.logRight}>
          <Text style={[styles.logDate, { color: colors.textSecondary }]}>{formatDate(item.date)}</Text>
          <View style={[styles.typeBadge, { backgroundColor: typeColor + '20' }]}>
            <Text style={[styles.typeBadgeText, { color: typeColor }]} numberOfLines={2}>
              {getTypeLabel(item)}
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
      <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.surfaceAlt }]}>
          <Search color={colors.textSecondary} size={16} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search logs..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X color={colors.textSecondary} size={16} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.equipmentFilterBtn, { backgroundColor: colors.surfaceAlt }]}
          onPress={() => setShowEquipmentFilter(true)}
        >
          <Text style={[styles.equipmentFilterText, { color: colors.text }]} numberOfLines={1}>
            {selectedEquipmentName}
          </Text>
          <ChevronDown color={colors.textSecondary} size={14} />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterScroll, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}
        contentContainerStyle={styles.filterContainer}
      >
        <Filter color={colors.textSecondary} size={16} />
        {(['all', 'routine', 'repair', 'inspection', 'fuel', 'workorder'] as FilterType[]).map(type => (
          <TouchableOpacity
            key={type}
            style={[styles.filterButton, { backgroundColor: colors.surfaceAlt }, filterType === type && { backgroundColor: colors.primary }]}
            onPress={() => setFilterType(type)}
          >
            <Text
              style={[styles.filterText, { color: colors.textSecondary }, filterType === type && { color: colors.textOnPrimary }]}
              numberOfLines={1}
            >
              {type === 'all' ? 'All' : type === 'workorder' ? 'Orders' : type === 'fuel' ? 'Fuel' : type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={groupedItems}
        keyExtractor={([title]) => title}
        renderItem={({ item: [title, items] }) => (
          <View>
            {renderSectionHeader(title)}
            {items.map(logItem => (
              <View key={logItem.id}>
                {renderLogItem(logItem)}
              </View>
            ))}
          </View>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Wrench color={colors.textSecondary} size={64} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Logs Found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {searchQuery || filterType !== 'all' || selectedEquipmentFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Start logging your equipment maintenance to track history'}
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
              style={[styles.menuItem, { borderBottomColor: colors.borderLight }]}
              onPress={() => {
                setShowAddMenu(false);
                router.push('/maintenance/add-fuel' as any);
              }}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: '#059669' + '15' }]}>
                <Fuel color="#059669" size={22} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>Log Fuel Fill-Up</Text>
                <Text style={[styles.menuItemSubtitle, { color: colors.textSecondary }]}>Record fuel and DEF usage</Text>
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

      <Modal
        visible={showEquipmentFilter}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEquipmentFilter(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowEquipmentFilter(false)}>
          <Pressable style={[styles.menuContainer, { backgroundColor: colors.surface }]} onPress={e => e.stopPropagation()}>
            <View style={[styles.menuHeader, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Filter by Equipment</Text>
              <TouchableOpacity onPress={() => setShowEquipmentFilter(false)}>
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ id: 'all', name: 'All Equipment' }, ...equipment]}
              keyExtractor={item => item.id}
              renderItem={({ item: eqItem }) => (
                <TouchableOpacity
                  style={[styles.equipmentFilterItem, { borderBottomColor: colors.borderLight }]}
                  onPress={() => {
                    setSelectedEquipmentFilter(eqItem.id);
                    setShowEquipmentFilter(false);
                  }}
                >
                  <Text style={[styles.equipmentFilterItemText, { color: colors.text }]}>{eqItem.name}</Text>
                  {selectedEquipmentFilter === eqItem.id && (
                    <View style={[styles.filterCheckmark, { backgroundColor: colors.primary }]}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' as const }}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              style={{ maxHeight: 400 }}
            />
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
    borderBottomWidth: 0,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  equipmentFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  equipmentFilterText: {
    fontSize: 13,
    fontWeight: '500' as const,
    flex: 1,
  },
  filterScroll: {
    borderBottomWidth: 1,
    maxHeight: 52,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    flexGrow: 1,
  },
  filterButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    flexShrink: 0,
  },
  filterText: {
    fontSize: 11,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
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
    maxWidth: 108,
    minWidth: 0,
  },
  logDate: {
    fontSize: 12,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    maxWidth: '100%',
    alignSelf: 'flex-end',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
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
  equipmentFilterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  equipmentFilterItemText: {
    fontSize: 15,
    flex: 1,
  },
  filterCheckmark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
