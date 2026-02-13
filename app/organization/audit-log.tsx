import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  Plus,
  Pencil,
  Trash2,
  Tractor,
  Wrench,
  Package,
  ClipboardList,
  Search,
  Clock,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/lib/supabase';
import { AuditLog } from '@/types/organization';
import { formatDate } from '@/utils/helpers';

const ENTITY_ICONS: Record<string, typeof Tractor> = {
  equipment: Tractor,
  maintenance_log: Wrench,
  maintenance_interval: Clock,
  consumable: Package,
  service_routine: ClipboardList,
  inspection_routine: Search,
};

const ACTION_ICONS: Record<string, { icon: typeof Plus; color: string }> = {
  create: { icon: Plus, color: Colors.success },
  update: { icon: Pencil, color: Colors.accent },
  delete: { icon: Trash2, color: Colors.danger },
};

export default function AuditLogScreen() {
  const { organization } = useOrganization();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 30;

  const fetchLogs = useCallback(async (pageNum: number, refresh: boolean = false) => {
    if (!organization) return;
    try {
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('org_id', organization.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.log('Error fetching audit logs:', error.message);
        return;
      }

      const newLogs = (data ?? []) as AuditLog[];
      if (refresh) {
        setLogs(newLogs);
      } else {
        setLogs(prev => [...prev, ...newLogs]);
      }
      setHasMore(newLogs.length === PAGE_SIZE);
    } catch (err) {
      console.log('Exception fetching audit logs:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [organization]);

  useEffect(() => {
    fetchLogs(0, true);
  }, [fetchLogs]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setPage(0);
    fetchLogs(0, true);
  }, [fetchLogs]);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchLogs(nextPage);
  }, [hasMore, isLoading, page, fetchLogs]);

  const renderItem = useCallback(({ item }: { item: AuditLog }) => {
    const EntityIcon = ENTITY_ICONS[item.entity_type] || ClipboardList;
    const actionConfig = ACTION_ICONS[item.action] || ACTION_ICONS.update;
    const ActionIcon = actionConfig.icon;

    const actionLabel = item.action === 'create' ? 'Created' : item.action === 'update' ? 'Updated' : 'Deleted';
    const entityLabel = item.entity_type.replace(/_/g, ' ');
    const timestamp = new Date(item.created_at);
    const timeStr = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = formatDate(item.created_at);

    return (
      <View style={styles.logItem}>
        <View style={[styles.actionBadge, { backgroundColor: actionConfig.color + '15' }]}>
          <ActionIcon color={actionConfig.color} size={14} />
        </View>
        <View style={styles.logContent}>
          <View style={styles.logHeader}>
            <Text style={styles.logUser} numberOfLines={1}>
              {item.user_name || item.user_email || 'Unknown'}
            </Text>
            <Text style={styles.logTime}>{timeStr}</Text>
          </View>
          <Text style={styles.logAction}>
            {actionLabel}{' '}
            <Text style={styles.logEntityType}>{entityLabel}</Text>
          </Text>
          {item.entity_name ? (
            <View style={styles.logEntityRow}>
              <EntityIcon color={Colors.textSecondary} size={12} />
              <Text style={styles.logEntityName} numberOfLines={1}>{item.entity_name}</Text>
            </View>
          ) : null}
          <Text style={styles.logDate}>{dateStr}</Text>
        </View>
      </View>
    );
  }, []);

  if (isLoading && logs.length === 0) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Audit Log' }} />
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Audit Log' }} />
      <FlatList
        data={logs}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Clock color={Colors.textLight} size={48} />
            <Text style={styles.emptyTitle}>No Activity Yet</Text>
            <Text style={styles.emptySubtitle}>Changes made by team members will appear here</Text>
          </View>
        }
        ListFooterComponent={
          hasMore && logs.length > 0 ? (
            <ActivityIndicator style={styles.footer} size="small" color={Colors.primary} />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  logItem: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  actionBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  logContent: {
    flex: 1,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  logUser: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  logTime: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  logAction: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  logEntityType: {
    fontWeight: '600' as const,
    color: Colors.text,
  },
  logEntityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  logEntityName: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  logDate: {
    fontSize: 11,
    color: Colors.textLight,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    paddingVertical: 20,
  },
});
