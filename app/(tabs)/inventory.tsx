import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Share,
  Alert,
  Modal,
  Platform,
  Image,
  RefreshControl,
  Keyboard,
} from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { 
  Plus, 
  Search, 
  Package, 
  AlertTriangle,
  ChevronRight,
  Share2,
  Download,
  Upload,
  FileSpreadsheet,
  X,
} from 'lucide-react-native';
import { useFarmData } from '@/contexts/FarmDataContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Consumable, CONSUMABLE_CATEGORIES, ConsumableCategory } from '@/types/equipment';
import { generateCSVTemplate, exportConsumablesToCSV, exportConsumablesToHTML } from '@/utils/csvHelpers';

export default function InventoryScreen() {
  const router = useRouter();
  const { consumables, equipment, isLoading, getLowStockConsumables, refreshData } = useFarmData();
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
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ConsumableCategory | 'all' | 'low-stock'>('all');

  const lowStockItems = useMemo(() => getLowStockConsumables(), [getLowStockConsumables]);

  const handleDownloadTemplate = async () => {
    const templateContent = generateCSVTemplate();
    
    if (Platform.OS === 'web') {
      const blob = new Blob([templateContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'parts_template.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      Alert.alert('Success', 'Template downloaded successfully!');
    } else {
      try {
        const file = new File(Paths.cache, 'parts_template.csv');
        file.create({ overwrite: true });
        file.write(templateContent);
        
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'text/csv',
            dialogTitle: 'Save Parts Template',
            UTI: 'public.comma-separated-values-text',
          });
        } else {
          await Share.share({
            message: templateContent,
            title: 'Parts Import Template',
          });
        }
      } catch (error) {
        console.log('Error sharing template:', error);
        Alert.alert('Error', 'Failed to download template. Please try again.');
      }
    }
    setShowAddMenu(false);
  };

  const handleExportInventory = async () => {
    if (consumables.length === 0) {
      Alert.alert('No Parts', 'Add some parts to your inventory first.');
      return;
    }

    const equipmentList = equipment.map(e => ({ id: e.id, name: e.name }));
    
    if (Platform.OS === 'web') {
      const htmlContent = exportConsumablesToHTML(consumables, equipmentList);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inventory_export_${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      Alert.alert('Success', 'Inventory exported successfully! Low stock items are highlighted in red.');
    } else {
      try {
        const csvContent = exportConsumablesToCSV(consumables, equipmentList);
        const fileName = `inventory_export_${new Date().toISOString().split('T')[0]}.csv`;
        const file = new File(Paths.cache, fileName);
        file.create({ overwrite: true });
        file.write(csvContent);
        
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'text/csv',
            dialogTitle: 'Save Inventory Export',
            UTI: 'public.comma-separated-values-text',
          });
        } else {
          await Share.share({
            message: csvContent,
            title: 'Inventory Export',
          });
        }
      } catch (error) {
        console.log('Error sharing export:', error);
        Alert.alert('Error', 'Failed to export inventory. Please try again.');
      }
    }
    setShowAddMenu(false);
  };

  const handleImportCSV = async () => {
    setShowAddMenu(false);
    router.push('/inventory/import' as any);
  };

  const filteredConsumables = useMemo(() => {
    let filtered = consumables;

    if (selectedCategory === 'low-stock') {
      filtered = lowStockItems;
    } else if (selectedCategory !== 'all') {
      filtered = consumables.filter(c => c.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        c =>
          c.name.toLowerCase().includes(query) ||
          c.partNumber.toLowerCase().includes(query) ||
          (c.supplier?.toLowerCase().includes(query))
      );
    }

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [consumables, lowStockItems, selectedCategory, searchQuery]);

  const getCategoryLabel = (category: ConsumableCategory) => {
    return CONSUMABLE_CATEGORIES.find(c => c.value === category)?.label ?? category;
  };

  const renderConsumableItem = ({ item }: { item: Consumable }) => {
    const isLowStock = item.quantity <= item.lowStockThreshold;
    
    return (
      <TouchableOpacity
        style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push(`/inventory/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.itemHeader}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.itemThumbnail} />
          ) : (
            <View style={[styles.categoryBadge, { backgroundColor: colors.primaryLight + '15' }, isLowStock && { backgroundColor: colors.danger + '15' }]}>
              {isLowStock ? (
                <AlertTriangle color={colors.danger} size={14} />
              ) : (
                <Package color={colors.primary} size={14} />
              )}
            </View>
          )}
          <View style={styles.itemInfo}>
            <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.partNumber, { color: colors.textSecondary }]}>#{item.partNumber}</Text>
          </View>
          <ChevronRight color={colors.textSecondary} size={20} />
        </View>
        
        <View style={[styles.itemDetails, { backgroundColor: colors.surfaceAlt }]}>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Category</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{getCategoryLabel(item.category)}</Text>
          </View>
          {item.supplier && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Supplier</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{item.supplier}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>In Stock</Text>
            <Text style={[
              styles.stockValue,
              { color: colors.success },
              isLowStock && { color: colors.danger },
            ]}>
              {item.quantity} {isLowStock && `(Low: ≤${item.lowStockThreshold})`}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Package color={colors.textSecondary} size={64} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {searchQuery || selectedCategory !== 'all' 
          ? 'No parts found' 
          : 'No parts in inventory'}
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        {searchQuery || selectedCategory !== 'all'
          ? 'Try adjusting your search or filter'
          : 'Add consumables and parts to track your inventory'}
      </Text>
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
      <View style={styles.searchContainer}>
        <View style={[styles.searchInputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Search color={colors.textSecondary} size={20} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by name or part number..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[
            { value: 'all' as const, label: 'All' },
            { value: 'low-stock' as const, label: `Low Stock (${lowStockItems.length})` },
            ...CONSUMABLE_CATEGORIES,
          ]}
          keyExtractor={(item) => item.value}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                { backgroundColor: colors.surface, borderColor: colors.border },
                selectedCategory === item.value && { backgroundColor: colors.primary, borderColor: colors.primary },
                item.value === 'low-stock' && lowStockItems.length > 0 && { borderColor: colors.warning },
              ]}
              onPress={() => setSelectedCategory(item.value)}
            >
              {item.value === 'low-stock' && lowStockItems.length > 0 && (
                <AlertTriangle 
                  color={selectedCategory === item.value ? colors.textOnPrimary : colors.warning} 
                  size={14} 
                />
              )}
              <Text style={[
                styles.filterChipText,
                { color: colors.textSecondary },
                selectedCategory === item.value && { color: colors.textOnPrimary },
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <View style={[styles.statsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }]}>{consumables.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Parts</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text }, lowStockItems.length > 0 && { color: colors.warning }]}>
            {lowStockItems.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Low Stock</Text>
        </View>
        {lowStockItems.length > 0 && (
          <TouchableOpacity
            style={[styles.exportButton, { backgroundColor: colors.warning }]}
            onPress={handleExportInventory}
            activeOpacity={0.7}
          >
            <Share2 color={colors.textOnPrimary} size={16} />
            <Text style={[styles.exportButtonText, { color: colors.textOnPrimary }]}>Export</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filteredConsumables}
        keyExtractor={(item) => item.id}
        renderItem={renderConsumableItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
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
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.accent }]}
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
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={() => setShowAddMenu(false)}
        >
          <View style={[styles.menuContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Add Parts</Text>
              <TouchableOpacity onPress={() => setShowAddMenu(false)}>
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowAddMenu(false);
                router.push('/inventory/add' as any);
              }}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: colors.primary + '15' }]}>
                <Plus color={colors.primary} size={22} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>Add Single Part</Text>
                <Text style={[styles.menuItemDescription, { color: colors.textSecondary }]}>Manually add one part to inventory</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleImportCSV}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: colors.accent + '15' }]}>
                <Upload color={colors.accent} size={22} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>Import from Spreadsheet</Text>
                <Text style={[styles.menuItemDescription, { color: colors.textSecondary }]}>Bulk import parts from a CSV file</Text>
              </View>
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <Text style={[styles.menuSectionTitle, { color: colors.textSecondary }]}>Templates & Export</Text>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleDownloadTemplate}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: colors.success + '15' }]}>
                <FileSpreadsheet color={colors.success} size={22} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>Download Template</Text>
                <Text style={[styles.menuItemDescription, { color: colors.textSecondary }]}>Get a CSV template with example data</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleExportInventory}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: colors.warning + '15' }]}>
                <Download color={colors.warning} size={22} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>Export Inventory</Text>
                <Text style={[styles.menuItemDescription, { color: colors.textSecondary }]}>Download all parts as CSV</Text>
              </View>
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
    padding: 16,
    paddingBottom: 8,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
  },
  filterContainer: {
    paddingBottom: 8,
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  exportButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  listContent: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 100,
  },
  itemCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemThumbnail: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  partNumber: {
    fontSize: 13,
    marginTop: 2,
  },
  itemDetails: {
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 13,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  stockValue: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingHorizontal: 20,
  },
  menuIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTextContainer: {
    flex: 1,
    marginLeft: 14,
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
    marginVertical: 12,
    marginHorizontal: 20,
  },
  menuSectionTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
});
