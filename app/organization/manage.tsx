import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  Users,
  Crown,
  Shield,
  User,
  Copy,
  RefreshCw,
  Trash2,
  ChevronRight,
  FileText,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { OrganizationMember, UserRole } from '@/types/organization';

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; icon: typeof Crown }> = {
  owner: { label: 'Owner', color: Colors.accent, icon: Crown },
  admin: { label: 'Admin', color: Colors.primary, icon: Shield },
  member: { label: 'Member', color: Colors.textSecondary, icon: User },
};

export default function ManageOrganizationScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    organization,
    members,
    isOwner,
    isAdmin,
    regenerateInviteCode,
    updateMemberRole,
    removeMember,
    leaveOrganization,
    refreshMembers,
  } = useOrganization();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleCopyCode = useCallback(async () => {
    if (!organization) return;
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(organization.invite_code);
      } else {
        await Share.share({ message: `Join my farm on FarmGuard! Use invite code: ${organization.invite_code}` });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.log('Copy error:', err);
    }
  }, [organization]);

  const handleRegenerateCode = useCallback(() => {
    Alert.alert(
      'Regenerate Code',
      'The old invite code will stop working. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          onPress: async () => {
            try {
              await regenerateInviteCode();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'New invite code generated.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to regenerate code.');
            }
          },
        },
      ]
    );
  }, [regenerateInviteCode]);

  const handleChangeRole = useCallback((member: OrganizationMember) => {
    if (member.user_id === user?.id) return;
    if (member.role === 'owner') return;

    const options = ['Admin', 'Member', 'Cancel'];
    Alert.alert(
      'Change Role',
      `Change role for ${(member.profiles as any)?.full_name || (member.profiles as any)?.email || 'this member'}?`,
      [
        { text: 'Admin', onPress: () => updateMemberRole(member.id, 'admin') },
        { text: 'Member', onPress: () => updateMemberRole(member.id, 'member') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [user, updateMemberRole]);

  const handleRemoveMember = useCallback((member: OrganizationMember) => {
    if (member.user_id === user?.id) return;
    const name = (member.profiles as any)?.full_name || (member.profiles as any)?.email || 'this member';
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${name} from the farm?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMember(member.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to remove member.');
            }
          },
        },
      ]
    );
  }, [user, removeMember]);

  const handleLeave = useCallback(() => {
    if (isOwner) {
      Alert.alert('Cannot Leave', 'As the owner, you must transfer ownership before leaving.');
      return;
    }
    Alert.alert(
      'Leave Farm',
      'Are you sure you want to leave this farm? You will lose access to all shared data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveOrganization();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to leave farm.');
            }
          },
        },
      ]
    );
  }, [isOwner, leaveOrganization]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshMembers();
    } catch (err) {
      console.log('Refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshMembers]);

  if (!organization) return null;

  const sortedMembers = [...members].sort((a, b) => {
    const order: Record<string, number> = { owner: 0, admin: 1, member: 2 };
    return (order[a.role] ?? 3) - (order[b.role] ?? 3);
  });

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Stack.Screen options={{ title: 'Manage Farm' }} />

      <View style={styles.orgCard}>
        <Text style={styles.orgName}>{organization.name}</Text>
        <Text style={styles.orgMeta}>{members.length} member{members.length !== 1 ? 's' : ''}</Text>
      </View>

      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invite Code</Text>
          <View style={styles.codeCard}>
            <Text style={styles.codeText}>{organization.invite_code}</Text>
            <View style={styles.codeActions}>
              <TouchableOpacity style={styles.codeButton} onPress={handleCopyCode}>
                <Copy color={Colors.primary} size={18} />
                <Text style={styles.codeButtonText}>Share</Text>
              </TouchableOpacity>
              {isOwner && (
                <TouchableOpacity style={styles.codeButton} onPress={handleRegenerateCode}>
                  <RefreshCw color={Colors.accent} size={18} />
                  <Text style={[styles.codeButtonText, { color: Colors.accent }]}>Regenerate</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Members</Text>
          <TouchableOpacity onPress={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <RefreshCw color={Colors.textSecondary} size={18} />
            )}
          </TouchableOpacity>
        </View>

        {sortedMembers.map((member) => {
          const config = ROLE_CONFIG[member.role as UserRole] || ROLE_CONFIG.member;
          const IconComponent = config.icon;
          const memberProfile = member.profiles as any;
          const isCurrentUser = member.user_id === user?.id;

          return (
            <View key={member.id} style={styles.memberRow}>
              <View style={[styles.memberAvatar, { backgroundColor: config.color + '15' }]}>
                <IconComponent color={config.color} size={18} />
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {memberProfile?.full_name || memberProfile?.email || 'Unknown'}
                  {isCurrentUser ? ' (You)' : ''}
                </Text>
                <Text style={[styles.memberRole, { color: config.color }]}>{config.label}</Text>
              </View>
              {isAdmin && !isCurrentUser && member.role !== 'owner' && (
                <View style={styles.memberActions}>
                  <TouchableOpacity
                    style={styles.memberActionBtn}
                    onPress={() => handleChangeRole(member)}
                  >
                    <Shield color={Colors.textSecondary} size={16} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.memberActionBtn}
                    onPress={() => handleRemoveMember(member)}
                  >
                    <Trash2 color={Colors.danger} size={16} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {isAdmin && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity</Text>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/organization/audit-log' as any)}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: '#3B82F6' + '15' }]}>
                <FileText color="#3B82F6" size={20} />
              </View>
              <View>
                <Text style={styles.settingLabel}>Audit Log</Text>
                <Text style={styles.settingDescription}>See who made changes</Text>
              </View>
            </View>
            <ChevronRight color={Colors.textSecondary} size={20} />
          </TouchableOpacity>
        </View>
      )}

      {!isOwner && (
        <View style={styles.section}>
          <TouchableOpacity style={styles.dangerRow} onPress={handleLeave}>
            <Trash2 color={Colors.danger} size={18} />
            <Text style={styles.dangerText}>Leave Farm</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  orgCard: {
    backgroundColor: Colors.primary,
    margin: 16,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  orgName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#fff',
  },
  orgMeta: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  codeCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
  },
  codeText: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 16,
  },
  codeActions: {
    flexDirection: 'row',
    gap: 16,
  },
  codeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Colors.background,
  },
  codeButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  memberRole: {
    fontSize: 12,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
  },
  memberActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  settingDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.danger + '08',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.danger + '20',
  },
  dangerText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.danger,
  },
});
