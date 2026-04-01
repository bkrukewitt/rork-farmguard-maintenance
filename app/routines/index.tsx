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
  ClipboardList, 
  ChevronRight,
  Trash2,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useFarmData } from '@/contexts/FarmDataContext';
import { ServiceRoutine } from '@/types/equipment';

export default function ServiceRoutinesScreen() {
  const router = useRouter();
  const { serviceRoutines, isLoading, deleteServiceRoutine } = useFarmData();

  const handleDelete = (routine: ServiceRoutine) => {
    Alert.alert(
      'Delete Routine',
      `Are you sure you want to delete "${routine.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteServiceRoutine(routine.id);
            } catch (error) {
              console.log('Error deleting routine:', error);
            }
          },
        },
      ]
    );
  };

  const renderRoutineItem = ({ item }: { item: ServiceRoutine }) => (
    <View style={styles.routineCard}>
      <TouchableOpacity
        style={styles.routineContent}
        onPress={() => router.push(`/routines/edit/${item.id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.routineIcon}>
          <ClipboardList color={Colors.primary} size={20} />
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
      <ClipboardList color={Colors.textSecondary} size={64} />
      <Text style={styles.emptyTitle}>No Service Routines</Text>
      <Text style={styles.emptySubtitle}>
        Create custom service routines with checklists to use when logging maintenance
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => router.push('/routines/add' as any)}
      >
        <Plus color={Colors.textOnPrimary} size={20} />
        <Text style={styles.emptyButtonText}>Create Routine</Text>
      </TouchableOpacity>
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
    <>
      <Stack.Screen
        options={{
          title: 'Service Routines',
          headerStyle: { backgroundColor: Colors.surface },
          headerTintColor: Colors.text,
        }}
      />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerText}>
            Create reusable service routines with checklists that can be used when logging maintenance.
          </Text>
        </View>

        <FlatList
          data={serviceRoutines}
          keyExtractor={(item) => item.id}
          renderItem={renderRoutineItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />

        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/routines/add' as any)}
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
    backgroundColor: Colors.primaryLight + '15',
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
    color: Colors.primary,
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
    backgroundColor: Colors.primary,
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
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
