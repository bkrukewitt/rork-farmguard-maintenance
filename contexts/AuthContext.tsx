import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { Profile } from '@/types/organization';

const GUEST_MODE_KEY = 'farmguard_guest_mode';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.log('Error fetching profile:', error.message);
        return null;
      }
      return data as Profile;
    } catch (err) {
      console.log('Exception fetching profile:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const guestFlag = await AsyncStorage.getItem(GUEST_MODE_KEY);
      if (guestFlag === 'true') {
        console.log('Guest mode detected');
        setIsGuest(true);
      }

      const { data: { session: s } } = await supabase.auth.getSession();
      console.log('Initial session check:', s ? 'authenticated' : 'not authenticated');
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setIsGuest(false);
        await AsyncStorage.removeItem(GUEST_MODE_KEY);
        const p = await fetchProfile(s.user.id);
        setProfile(p);
      }
      setIsLoading(false);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        console.log('Auth state changed:', _event, s?.user?.email);
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          setIsGuest(false);
          await AsyncStorage.removeItem(GUEST_MODE_KEY);
          const p = await fetchProfile(s.user.id);
          setProfile(p);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });
    return () => sub.remove();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    console.log('Signing in:', email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
    return data;
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    console.log('Signing up:', email);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    if (error) throw error;
    return data;
  }, []);

  const signOut = useCallback(async () => {
    console.log('Signing out');
    if (isGuest) {
      setIsGuest(false);
      await AsyncStorage.removeItem(GUEST_MODE_KEY);
      return;
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  }, [isGuest]);

  const enterGuestMode = useCallback(async () => {
    console.log('Entering guest mode');
    setIsGuest(true);
    await AsyncStorage.setItem(GUEST_MODE_KEY, 'true');
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase()
    );
    if (error) throw error;
  }, []);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) throw error;
    const updated = await fetchProfile(user.id);
    setProfile(updated);
  }, [user, fetchProfile]);

  return {
    session,
    user,
    profile,
    isLoading,
    isAuthenticated: !!session,
    isGuest,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateProfile,
    enterGuestMode,
  };
});
