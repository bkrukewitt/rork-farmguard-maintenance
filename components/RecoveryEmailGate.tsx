import React, { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFarmData } from '@/contexts/FarmDataContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function RecoveryEmailGate() {
  const { colors } = useTheme();
  const {
    farmId,
    isAdmin,
    isDemoMode,
    recoveryEmail,
    setRecoveryEmail,
    isSettingRecoveryEmail,
  } = useFarmData();
  const [emailInput, setEmailInput] = useState('');
  const [error, setError] = useState('');

  const mustCollectEmail = useMemo(() => {
    if (isDemoMode) return false;
    if (!farmId) return false;
    if (!isAdmin) return false;
    return !recoveryEmail;
  }, [farmId, isAdmin, isDemoMode, recoveryEmail]);

  const handleSave = async () => {
    const normalized = emailInput.trim().toLowerCase();
    if (!normalized) {
      setError('Please enter your recovery email.');
      return;
    }
    try {
      await setRecoveryEmail(normalized);
      setError('');
      setEmailInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recovery email.');
    }
  };

  return (
    <Modal visible={mustCollectEmail} transparent animationType="fade" onRequestClose={() => {}}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 8 }}>
            Recovery Email Required
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 12 }}>
            To protect your farm, add an admin recovery email now. This email is used for password recovery only.
          </Text>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: error ? colors.statusOverdue : colors.border,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: colors.text,
              backgroundColor: colors.background,
            }}
            value={emailInput}
            onChangeText={(v) => {
              setEmailInput(v);
              setError('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="admin@yourfarm.com"
            placeholderTextColor={colors.textSecondary}
          />
          {error ? (
            <Text style={{ color: colors.statusOverdue, marginTop: 8 }}>{error}</Text>
          ) : null}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSettingRecoveryEmail}
            style={{
              marginTop: 12,
              backgroundColor: colors.primary,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              height: 44,
              opacity: isSettingRecoveryEmail ? 0.7 : 1,
            }}
          >
            {isSettingRecoveryEmail ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '700' }}>Save Recovery Email</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
