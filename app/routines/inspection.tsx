import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { 
  Plus, 
  Search, 
  ChevronRight,
  Trash2,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { InspectionRoutine } from '@/types/equipment';

const INSPECTION_COLOR = '#8B5CF6';

export default function InspectionRoutinesScreen() {
  const router = useRouter();
  const { inspectionRoutines, isLoading, deleteInspectionRoutine } = useFarmData();

  const handleDelete = (routine: InspectionRoutine) => {
    Alert.alert(
      'Delete Inspection Routine',
      `Are you sure you want to delete "${routine.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteInspectionRoutine(routine.id);
            } catch (error) {
              console.log('Error deleting inspection routine:', error);
            }
          },
        },
      ]
    );
  };

  const renderRoutineItem = ({ item }: { item: InspectionRoutine }) => (
    <View style={styles.routineCard}>
      <TouchableOpacity
        style={styles.routineContent}
        onPress={() => router.push(`/routines/edit-inspection/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.routineIcon}>
          <Search color={INSPECTION_COLOR} size={20} />
        </View>
        <View style={styles.routineInfo}>
          <Text style={styles.routineName}>{item.name}</Text>
          {item.description && (
            <Text style={styles.routineDescription} numberOfLines={1}>
              {item.description}
            </Text>
          )}
          <Text style={styles.checklistCount}>
            {item.checklistItems.length} checklist item{item.checklistItems.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <ChevronRight color={Colors.textSecondary} size={20} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(item)}
      >
        <Trash2 color={Colors.danger} size={18} />
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Search color={Colors.textSecondary} size={64} />
      <Text style={styles.emptyTitle}>No Inspection Routines</Text>
      <Text style={styles.emptySubtitle}>
        Create custom inspection routines with checklists to standardize your equipment inspections
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => router.push('/routines/add-inspection' as any)}
      >
        <Plus color={Colors.textOnPrimary} size={20} />
        <Text style={styles.emptyButtonText}>Create Inspection</Text>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={INSPECTION_COLOR} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Inspection Routines',
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.text,
        }}
      />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerText}>
            Create reusable inspection routines with checklists to standardize equipment inspections.
          </Text>
        </View>

        <FlatList
          data={inspectionRoutines}
          keyExtractor={(item) => item.id}
          renderItem={renderRoutineItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />

        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/routines/add-inspection' as any)}
          activeOpacity={0.8}
        >
          <Plus color={Colors.textOnPrimary} size={28} />
        </TouchableOpacity>
      </View>
    </>
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
    padding: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  routineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  routineContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  routineIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: INSPECTION_COLOR + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  routineInfo: {
    flex: 1,
    marginLeft: 12,
  },
  routineName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  routineDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  checklistCount: {
    fontSize: 12,
    color: INSPECTION_COLOR,
    marginTop: 4,
    fontWeight: '500' as const,
  },
  deleteButton: {
    padding: 16,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
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
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INSPECTION_COLOR,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 24,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textOnPrimary,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: INSPECTION_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
