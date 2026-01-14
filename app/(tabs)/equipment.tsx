import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
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
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { Equipment, EquipmentType } from '@/types/equipment';
import { formatHours, getMaintenanceStatus } from '@/utils/helpers';

const EQUIPMENT_ICONS: Record<EquipmentType, React.ComponentType<{ color: string; size: number }>> = {
  tractor: Tractor,
  combine: Wheat,
  truck: Truck,
  implement: Tool,
  sprayer: Droplets,
  planter: Sprout,
  loader: Container,
  mower: Fan,
  other: Settings,
};

export default function EquipmentScreen() {
  const router = useRouter();
  const { equipment, intervals, isLoading } = useFarmData();
  const [searchQuery, setSearchQuery] = useState('');

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
    const statusColor = status === 'overdue' ? Colors.statusOverdue :
                        status === 'due' ? Colors.statusDue : Colors.statusOk;

    return (
      <TouchableOpacity
        style={styles.equipmentCard}
        onPress={() => router.push(`/equipment/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.cardLeft}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.thumbnailImage} />
          ) : (
            <View style={[styles.iconContainer, { backgroundColor: Colors.primary + '15' }]}>
              <Icon color={Colors.primary} size={28} />
            </View>
          )}
        </View>
        
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.equipmentName} numberOfLines={1}>{item.name}</Text>
            <StatusIcon color={statusColor} size={18} />
          </View>
          <Text style={styles.equipmentDetails}>
            {item.year} {item.make} {item.model}
          </Text>
          <View style={styles.cardFooter}>
            <Text style={styles.hoursText}>{formatHours(item.currentHours)}</Text>
            <Text style={styles.typeText}>{item.type.charAt(0).toUpperCase() + item.type.slice(1)}</Text>
          </View>
        </View>
        
        <ChevronRight color={Colors.textSecondary} size={20} />
      </TouchableOpacity>
    );
  };

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
        <Search color={Colors.textSecondary} size={20} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search equipment..."
          placeholderTextColor={Colors.textSecondary}
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
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Tractor color={Colors.textSecondary} size={64} />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No Results' : 'No Equipment'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery 
                ? 'Try a different search term' 
                : 'Add your first piece of equipment to get started'}
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/equipment/add' as any)}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 16,
    color: Colors.text,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  equipmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: Colors.cardShadow,
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
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  equipmentDetails: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hoursText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  typeText: {
    fontSize: 13,
    color: Colors.textSecondary,
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
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
