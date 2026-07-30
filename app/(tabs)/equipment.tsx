import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  Share,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  Keyboard,
} from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { 
  Plus, 
  Search, 
  Tractor, 
  Truck, 
  Wheat, 
  Wrench as Tool, 
  Droplets, 
  Sprout, 
  Container, 
  Settings,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle,
  Fan,
  Download,
  Upload,
  Share2,
  X,
  CarFront,
  Warehouse,
} from 'lucide-react-native';
import { useFarmData } from '@/contexts/FarmDataContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Equipment, EquipmentType } from '@/types/equipment';
import { getMaintenanceStatus } from '@/utils/helpers';
import { generateEquipmentCSVTemplate, exportEquipmentToCSV } from '@/utils/csvHelpers';
import { getEquipmentListCardSubtitle } from '@/utils/equipmentFormConfig';

const EQUIPMENT_ICONS: Record<EquipmentType, React.ComponentType<{ color: string; size: number }>> = {
  tractor: Tractor,
  combine: Wheat,
  truck: Truck,
  implement: Tool,
  sprayer: Droplets,
  planter: Sprout,
  loader: Container,
  mower: Fan,
  utv: CarFront,
  building: Warehouse,
  other: Settings,
};

export default function EquipmentScreen() {
  const router = useRouter();
  const { showAddMenu: showAddMenuParam } = useLocalSearchParams<{ showAddMenu?: string }>();
  const { equipment, intervals, isLoading, refreshData } = useFarmData();
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(showAddMenuParam === 'true');

  React.useEffect(() => {
    if (showAddMenuParam === 'true') {
      setShowAddMenu(true);
      router.setParams({ showAddMenu: undefined });
    }
  }, [showAddMenuParam, router]);

  const handleDownloadTemplate = async () => {
    const templateContent = generateEquipmentCSVTemplate();
    
    if (Platform.OS === 'web') {
      const blob = new Blob([templateContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'equipment_template.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      Alert.alert('Success', 'Template downloaded successfully!');
    } else {
      try {
        const file = new File(Paths.cache, 'equipment_template.csv');
        file.create({ overwrite: true });
        file.write(templateContent);
        
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'text/csv',
            dialogTitle: 'Save Equipment Template',
            UTI: 'public.comma-separated-values-text',
          });
        } else {
          await Share.share({
            message: templateContent,
            title: 'Equipment Import Template',
          });
        }
      } catch (error) {
        console.log('Error sharing template:', error);
        Alert.alert('Error', 'Failed to download template. Please try again.');
      }
    }
    setShowAddMenu(false);
  };

  const handleExportEquipment = async () => {
    if (equipment.length === 0) {
      Alert.alert('No Equipment', 'Add some equipment to your fleet first.');
      return;
    }

    const csvContent = exportEquipmentToCSV(equipment);
    
    if (Platform.OS === 'web') {
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `equipment_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      Alert.alert('Success', 'Equipment exported successfully!');
    } else {
      try {
        const fileName = `equipment_export_${new Date().toISOString().split('T')[0]}.csv`;
        const file = new File(Paths.cache, fileName);
        file.create({ overwrite: true });
        file.write(csvContent);
        
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'text/csv',
            dialogTitle: 'Save Equipment Export',
            UTI: 'public.comma-separated-values-text',
          });
        } else {
          await Share.share({
            message: csvContent,
            title: 'Equipment Export',
          });
        }
      } catch (error) {
        console.log('Error sharing export:', error);
        Alert.alert('Error', 'Failed to export equipment. Please try again.');
      }
    }
    setShowAddMenu(false);
  };

  const filteredEquipment = useMemo(() => {
    if (!searchQuery.trim()) return equipment;
    const query = searchQuery.toLowerCase();
    return equipment.filter(
      e =>
        e.name.toLowerCase().includes(query) ||
        e.make.toLowerCase().includes(query) ||
        e.model.toLowerCase().includes(query)
    );
  }, [equipment, searchQuery]);

  const getEquipmentStatus = (eq: Equipment): 'ok' | 'due' | 'overdue' => {
    const eqIntervals = intervals.filter(i => i.equipmentId === eq.id);
    let worstStatus: 'ok' | 'due' | 'overdue' = 'ok';

    eqIntervals.forEach(interval => {
      const status = getMaintenanceStatus(
        interval.lastPerformedHours,
        eq.currentHours,
        interval.intervalHours,
        interval.lastPerformedDate,
        interval.intervalDays
      );
      if (status === 'overdue') worstStatus = 'overdue';
      else if (status === 'due' && worstStatus !== 'overdue') worstStatus = 'due';
    });

    return worstStatus;
  };

  const renderEquipmentCard = ({ item }: { item: Equipment }) => {
    const Icon = EQUIPMENT_ICONS[item.type] || Settings;
    const status = getEquipmentStatus(item);
    
    const StatusIcon = status === 'overdue' ? AlertTriangle : 
                       status === 'due' ? Clock : CheckCircle;
    const statusColor = status === 'overdue' ? colors.statusOverdue :
                        status === 'due' ? colors.statusDue : colors.statusOk;

    return (
      <TouchableOpacity
        style={[styles.equipmentCard, { backgroundColor: colors.surface, shadowColor: colors.cardShadow }]}
        onPress={() => router.push(`/equipment/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.cardLeft}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.thumbnailImage} />
          ) : (
            <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
              <Icon color={colors.primary} size={28} />
            </View>
          )}
        </View>
        
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={[styles.equipmentName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
            <StatusIcon color={statusColor} size={18} />
          </View>
          <Text style={[styles.equipmentDetails, { color: colors.textSecondary }]}>
            {item.year} {item.make} {item.model}
          </Text>
          <View style={styles.cardFooter}>
            <Text style={[styles.hoursText, { color: colors.primary }]}>{getEquipmentListCardSubtitle(item)}</Text>
            <Text style={[styles.typeText, { color: colors.textSecondary }]}>{item.type.charAt(0).toUpperCase() + item.type.slice(1)}</Text>
          </View>
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
      <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Search color={colors.textSecondary} size={20} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search equipment..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredEquipment}
        keyExtractor={(item) => item.id}
        renderItem={renderEquipmentCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={Keyboard.dismiss}
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
            <Tractor color={colors.textSecondary} size={64} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {searchQuery ? 'No Results' : 'No Equipment'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {searchQuery 
                ? 'Try a different search term' 
                : 'Add your first piece of equipment to get started'}
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
        onPress={() => setShowAddMenu(true)}
        activeOpacity={0.8}
      >
        <Plus color={colors.textOnPrimary} size={28} />
      </TouchableOpacity>

      <Modal
        visible={showAddMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddMenu(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAddMenu(false)}
        >
          <View style={[styles.menuContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.menuHeader}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Add Equipment</Text>
              <TouchableOpacity onPress={() => setShowAddMenu(false)}>
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowAddMenu(false);
                router.push('/equipment/add' as any);
              }}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: colors.primary + '15' }]}>
                <Plus color={colors.primary} size={22} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>Add Manually</Text>
                <Text style={[styles.menuItemDescription, { color: colors.textSecondary }]}>Enter equipment details by hand</Text>
              </View>
              <ChevronRight color={colors.textSecondary} size={20} />
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <Text style={[styles.menuSectionTitle, { color: colors.textSecondary }]}>Bulk Import</Text>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleDownloadTemplate}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: colors.accent + '15' }]}>
                <Download color={colors.accent} size={22} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>Download Template</Text>
                <Text style={[styles.menuItemDescription, { color: colors.textSecondary }]}>Get CSV template with examples</Text>
              </View>
              <ChevronRight color={colors.textSecondary} size={20} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowAddMenu(false);
                router.push('/equipment/import' as any);
              }}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: colors.success + '15' }]}>
                <Upload color={colors.success} size={22} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>Import from CSV</Text>
                <Text style={[styles.menuItemDescription, { color: colors.textSecondary }]}>Upload completed spreadsheet</Text>
              </View>
              <ChevronRight color={colors.textSecondary} size={20} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleExportEquipment}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: colors.warning + '15' }]}>
                <Share2 color={colors.warning} size={22} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>Export Equipment</Text>
                <Text style={[styles.menuItemDescription, { color: colors.textSecondary }]}>Download current equipment as CSV</Text>
              </View>
              <ChevronRight color={colors.textSecondary} size={20} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  equipmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardLeft: {
    marginRight: 14,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  equipmentName: {
    fontSize: 17,
    fontWeight: '600' as const,
    flex: 1,
    marginRight: 8,
  },
  equipmentDetails: {
    fontSize: 14,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hoursText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  typeText: {
    fontSize: 13,
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
    padding: 20,
    paddingBottom: 40,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  menuIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
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
  },
  menuItemDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    marginVertical: 16,
  },
  menuSectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
});
