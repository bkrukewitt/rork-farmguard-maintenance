import React, { useState, useMemo } from 'react';
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
} from 'react-native';
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
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { Consumable, CONSUMABLE_CATEGORIES, ConsumableCategory } from '@/types/equipment';
import { generateCSVTemplate, exportConsumablesToCSV, exportConsumablesToHTML } from '@/utils/csvHelpers';

export default function InventoryScreen() {
  const router = useRouter();
  const { consumables, equipment, isLoading, getLowStockConsumables } = useFarmData();
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
        await Share.share({
          message: templateContent,
          title: 'Parts Import Template',
        });
      } catch (error) {
        console.log('Error sharing template:', error);
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
        await Share.share({
          message: csvContent,
          title: 'Inventory Export',
        });
      } catch (error) {
        console.log('Error sharing export:', error);
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
        style={styles.itemCard}
        onPress={() => router.push(`/inventory/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.itemHeader}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.itemThumbnail} />
          ) : (
            <View style={[styles.categoryBadge, isLowStock && styles.categoryBadgeLow]}>
              {isLowStock ? (
                <AlertTriangle color={Colors.danger} size={14} />
              ) : (
                <Package color={Colors.primary} size={14} />
              )}
            </View>
          )}
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.partNumber}>#{item.partNumber}</Text>
          </View>
          <ChevronRight color={Colors.textSecondary} size={20} />
        </View>
        
        <View style={styles.itemDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Category</Text>
            <Text style={styles.detailValue}>{getCategoryLabel(item.category)}</Text>
          </View>
          {item.supplier && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Supplier</Text>
              <Text style={styles.detailValue}>{item.supplier}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>In Stock</Text>
            <Text style={[
              styles.stockValue,
              isLowStock && styles.stockValueLow,
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
      <Package color={Colors.textSecondary} size={64} />
      <Text style={styles.emptyTitle}>
        {searchQuery || selectedCategory !== 'all' 
          ? 'No parts found' 
          : 'No parts in inventory'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery || selectedCategory !== 'all'
          ? 'Try adjusting your search or filter'
          : 'Add consumables and parts to track your inventory'}
      </Text>

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
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Search color={Colors.textSecondary} size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or part number..."
            placeholderTextColor={Colors.textSecondary}
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
                selectedCategory === item.value && styles.filterChipActive,
                item.value === 'low-stock' && lowStockItems.length > 0 && styles.filterChipWarning,
              ]}
              onPress={() => setSelectedCategory(item.value)}
            >
              {item.value === 'low-stock' && lowStockItems.length > 0 && (
                <AlertTriangle 
                  color={selectedCategory === item.value ? Colors.textOnPrimary : Colors.warning} 
                  size={14} 
                />
              )}
              <Text style={[
                styles.filterChipText,
                selectedCategory === item.value && styles.filterChipTextActive,
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{consumables.length}</Text>
          <Text style={styles.statLabel}>Total Parts</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, lowStockItems.length > 0 && styles.statValueWarning]}>
            {lowStockItems.length}
          </Text>
          <Text style={styles.statLabel}>Low Stock</Text>
        </View>
        {lowStockItems.length > 0 && (
          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExportInventory}
            activeOpacity={0.7}
          >
            <Share2 color={Colors.textOnPrimary} size={16} />
            <Text style={styles.exportButtonText}>Export</Text>
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
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddMenu(true)}
        activeOpacity={0.8}
      >
        <Plus color={Colors.textOnPrimary} size={28} />
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
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Add Parts</Text>
              <TouchableOpacity onPress={() => setShowAddMenu(false)}>
                <X color={Colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowAddMenu(false);
                router.push('/inventory/add' as any);
              }}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: Colors.primary + '15' }]}>
                <Plus color={Colors.primary} size={22} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuItemTitle}>Add Single Part</Text>
                <Text style={styles.menuItemDescription}>Manually add one part to inventory</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleImportCSV}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: Colors.accent + '15' }]}>
                <Upload color={Colors.accent} size={22} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuItemTitle}>Import from Spreadsheet</Text>
                <Text style={styles.menuItemDescription}>Bulk import parts from a CSV file</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.menuDivider} />
            <Text style={styles.menuSectionTitle}>Templates & Export</Text>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleDownloadTemplate}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: Colors.success + '15' }]}>
                <FileSpreadsheet color={Colors.success} size={22} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuItemTitle}>Download Template</Text>
                <Text style={styles.menuItemDescription}>Get a CSV template with example data</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleExportInventory}
            >
              <View style={[styles.menuIconContainer, { backgroundColor: Colors.warning + '15' }]}>
                <Download color={Colors.warning} size={22} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuItemTitle}>Export Inventory</Text>
                <Text style={styles.menuItemDescription}>Download all parts as CSV</Text>
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
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
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
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipWarning: {
    borderColor: Colors.warning,
  },
  filterChipText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  filterChipTextActive: {
    color: Colors.textOnPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  statValueWarning: {
    color: Colors.warning,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  exportButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textOnPrimary,
  },
  listContent: {
    padding: 16,
    paddingTop: 4,
    paddingBottom: 100,
  },
  itemCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: Colors.primaryLight + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadgeLow: {
    backgroundColor: Colors.danger + '15',
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
    color: Colors.text,
  },
  partNumber: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  itemDetails: {
    backgroundColor: Colors.surfaceAlt,
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
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  stockValue: {
    fontSize: 13,
    color: Colors.success,
    fontWeight: '600' as const,
  },
  stockValueLow: {
    color: Colors.danger,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
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
    backgroundColor: Colors.accent,
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
    backgroundColor: Colors.surface,
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
    borderBottomColor: Colors.border,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
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
    color: Colors.text,
  },
  menuItemDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
    marginHorizontal: 20,
  },
  menuSectionTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
});
