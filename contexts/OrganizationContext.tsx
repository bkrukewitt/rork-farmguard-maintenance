import { useState, useEffect, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Organization, OrganizationMember, UserRole } from '@/types/organization';

const ORG_STORAGE_KEY = 'farmguard_current_org_id';

export const [OrganizationProvider, useOrganization] = createContextHook(() => {
  const { user, isAuthenticated, profile } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userRole = useMemo<UserRole | null>(() => {
    if (!user || !members.length) return null;
    const member = members.find(m => m.user_id === user.id);
    return member?.role as UserRole ?? null;
  }, [user, members]);

  const isOwner = userRole === 'owner';
  const isAdmin = userRole === 'owner' || userRole === 'admin';

  const fetchOrganization = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const savedOrgId = await AsyncStorage.getItem(ORG_STORAGE_KEY);

      const { data: membershipData, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id);

      if (memberError) {
        console.log('Error fetching memberships:', memberError.message);
        setIsLoading(false);
        return;
      }

      if (!membershipData || membershipData.length === 0) {
        console.log('User has no organization');
        setOrganization(null);
        setMembers([]);
        setIsLoading(false);
        return;
      }

      const targetOrgId = savedOrgId && membershipData.some(m => m.organization_id === savedOrgId)
        ? savedOrgId
        : membershipData[0].organization_id;

      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', targetOrgId)
        .single();

      if (orgError) {
        console.log('Error fetching org:', orgError.message);
        setIsLoading(false);
        return;
      }

      setOrganization(orgData as Organization);
      await AsyncStorage.setItem(ORG_STORAGE_KEY, targetOrgId);

      const { data: membersData } = await supabase
        .from('organization_members')
        .select('*, profiles(*)')
        .eq('organization_id', targetOrgId);

      setMembers((membersData ?? []) as OrganizationMember[]);
    } catch (err) {
      console.log('Exception in fetchOrganization:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrganization();
    } else {
      setOrganization(null);
      setMembers([]);
      setIsLoading(false);
    }
  }, [isAuthenticated, fetchOrganization]);

  const createOrganization = useCallback(async (name: string) => {
    if (!user) throw new Error('Must be logged in');

    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .insert({ name, created_by: user.id })
      .select()
      .single();

    if (orgError) throw orgError;

    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: orgData.id,
        user_id: user.id,
        role: 'owner',
      });

    if (memberError) throw memberError;

    await AsyncStorage.setItem(ORG_STORAGE_KEY, orgData.id);
    console.log('Organization created:', orgData.name);
    await fetchOrganization();
    return orgData as Organization;
  }, [user, fetchOrganization]);

  const joinOrganization = useCallback(async (inviteCode: string) => {
    if (!user) throw new Error('Must be logged in');

    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('invite_code', inviteCode.trim().toLowerCase())
      .single();

    if (orgError || !orgData) throw new Error('Invalid invite code');

    const { data: existing } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', orgData.id)
      .eq('user_id', user.id)
      .single();

    if (existing) throw new Error('You are already a member of this organization');

    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: orgData.id,
        user_id: user.id,
        role: 'member',
      });

    if (memberError) throw memberError;

    await AsyncStorage.setItem(ORG_STORAGE_KEY, orgData.id);
    console.log('Joined organization:', orgData.name);
    await fetchOrganization();
    return orgData as Organization;
  }, [user, fetchOrganization]);

  const regenerateInviteCode = useCallback(async () => {
    if (!organization) throw new Error('No organization');
    const newCode = Math.random().toString(36).substring(2, 10);
    const { error } = await supabase
      .from('organizations')
      .update({ invite_code: newCode, updated_at: new Date().toISOString() })
      .eq('id', organization.id);

    if (error) throw error;
    setOrganization(prev => prev ? { ...prev, invite_code: newCode } : null);
    return newCode;
  }, [organization]);

  const updateMemberRole = useCallback(async (memberId: string, role: UserRole) => {
    if (!organization) throw new Error('No organization');
    const { error } = await supabase
      .from('organization_members')
      .update({ role })
      .eq('id', memberId)
      .eq('organization_id', organization.id);

    if (error) throw error;
    await fetchOrganization();
  }, [organization, fetchOrganization]);

  const removeMember = useCallback(async (memberId: string) => {
    if (!organization) throw new Error('No organization');
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', memberId)
      .eq('organization_id', organization.id);

    if (error) throw error;
    await fetchOrganization();
  }, [organization, fetchOrganization]);

  const leaveOrganization = useCallback(async () => {
    if (!organization || !user) throw new Error('No organization');
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('organization_id', organization.id)
      .eq('user_id', user.id);

    if (error) throw error;
    await AsyncStorage.removeItem(ORG_STORAGE_KEY);
    setOrganization(null);
    setMembers([]);
  }, [organization, user]);

  const refreshMembers = useCallback(async () => {
    if (!organization) return;
    const { data } = await supabase
      .from('organization_members')
      .select('*, profiles(*)')
      .eq('organization_id', organization.id);
    setMembers((data ?? []) as OrganizationMember[]);
  }, [organization]);

  return {
    organization,
    members,
    userRole,
    isOwner,
    isAdmin,
    isLoading,
    hasOrganization: !!organization,
    createOrganization,
    joinOrganization,
    regenerateInviteCode,
    updateMemberRole,
    removeMember,
    leaveOrganization,
    refreshMembers,
    refetch: fetchOrganization,
  };
});
