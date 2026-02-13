import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Building2, UserPlus, Tractor, LogOut } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';

export default function OrganizationSetupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { createOrganization, joinOrganization } = useOrganization();
  const { signOut, profile } = useAuth();
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [farmName, setFarmName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const buttonScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(buttonScale, { toValue: 0.96, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start();
  };

  const handleCreate = async () => {
    if (!farmName.trim()) {
      setError('Please enter a farm name.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await createOrganization(farmName.trim());
      console.log('Organization created successfully');
    } catch (err: any) {
      console.log('Create org error:', err.message);
      setError(err.message || 'Failed to create farm.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      setError('Please enter an invite code.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await joinOrganization(inviteCode.trim());
      console.log('Joined organization successfully');
    } catch (err: any) {
      console.log('Join org error:', err.message);
      setError(err.message || 'Failed to join farm.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.log('Sign out error:', err);
    }
  };

  if (mode === 'choose') {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Tractor color="#fff" size={36} />
            </View>
            <Text style={styles.title}>Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}!</Text>
            <Text style={styles.subtitle}>Set up your farm to get started</Text>
          </View>

          <TouchableOpacity style={styles.optionCard} onPress={() => setMode('create')} activeOpacity={0.7}>
            <View style={[styles.optionIcon, { backgroundColor: Colors.primary + '15' }]}>
              <Building2 color={Colors.primary} size={28} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Create a Farm</Text>
              <Text style={styles.optionDesc}>Start fresh and invite your team to join</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionCard} onPress={() => setMode('join')} activeOpacity={0.7}>
            <View style={[styles.optionIcon, { backgroundColor: Colors.accent + '15' }]}>
              <UserPlus color={Colors.accent} size={28} />
            </View>
            <View style={styles.optionContent}>
              <Text style={styles.optionTitle}>Join a Farm</Text>
              <Text style={styles.optionDesc}>Enter an invite code from your farm owner</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <LogOut color={Colors.textSecondary} size={18} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.backLink} onPress={() => { setMode('choose'); setError(''); }}>
            <Text style={styles.backLinkText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>
              {mode === 'create' ? 'Create Your Farm' : 'Join a Farm'}
            </Text>
            <Text style={styles.subtitle}>
              {mode === 'create'
                ? 'Give your farm a name. You can invite others after.'
                : 'Enter the invite code shared by your farm owner.'}
            </Text>
          </View>

          <View style={styles.formCard}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {mode === 'create' ? (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Farm Name</Text>
                <View style={styles.inputRow}>
                  <Building2 color={Colors.textSecondary} size={18} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Smith Family Farm"
                    placeholderTextColor={Colors.textLight}
                    value={farmName}
                    onChangeText={setFarmName}
                    autoFocus
                    testID="org-name"
                  />
                </View>
              </View>
            ) : (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Invite Code</Text>
                <View style={styles.inputRow}>
                  <UserPlus color={Colors.textSecondary} size={18} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter 8-character code"
                    placeholderTextColor={Colors.textLight}
                    value={inviteCode}
                    onChangeText={setInviteCode}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    testID="org-code"
                  />
                </View>
              </View>
            )}

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                style={[styles.button, isSubmitting && styles.buttonDisabled]}
                onPress={mode === 'create' ? handleCreate : handleJoin}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={isSubmitting}
                activeOpacity={0.8}
                testID="org-submit"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>
                    {mode === 'create' ? 'Create Farm' : 'Join Farm'}
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 20,
  },
  backLink: {
    marginBottom: 16,
  },
  backLinkText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600' as const,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  optionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 12,
  },
  signOutText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500' as const,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  errorBox: {
    backgroundColor: Colors.danger + '12',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
  },
  errorText: {
    fontSize: 13,
    color: Colors.danger,
    fontWeight: '500' as const,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: Colors.text,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
