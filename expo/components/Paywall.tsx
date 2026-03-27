import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Shield, Check, Tractor, Wrench, Package, ClipboardList, Star, RefreshCw, X, Eye } from 'lucide-react-native';
import { PurchasesPackage } from 'react-native-purchases';
import { usePurchases } from '@/contexts/PurchasesContext';
import { useFarmData } from '@/contexts/FarmDataContext';

const ADMIN_PIN = '7743';
const REQUIRED_TAPS = 7;

const FEATURES = [
  { icon: Tractor, text: 'Unlimited equipment tracking' },
  { icon: Wrench, text: 'Full maintenance history & logs' },
  { icon: Package, text: 'Parts & inventory management' },
  { icon: ClipboardList, text: 'Work orders & service routines' },
  { icon: Star, text: 'Farm sync across devices' },
  { icon: Shield, text: 'Priority support' },
];

interface PaywallProps {
  onDismiss?: () => void;
}

export default function Paywall({ onDismiss }: PaywallProps) {
  const insets = useSafeAreaInsets();
  const {
    offerings,
    isLoadingOfferings,
    purchasePackage,
    isPurchasing,
    restorePurchases,
    isRestoring,
    startTrial,
    setAdminOverride,
  } = usePurchases();

  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);

  // Secret admin override: tap "FarmGuard" text 7 times
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const handleAppNameTap = useCallback(() => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 3000);

    if (tapCountRef.current >= REQUIRED_TAPS) {
      tapCountRef.current = 0;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      setPinInput('');
      setPinError('');
      setShowPinModal(true);
    }
  }, []);

  const handlePinSubmit = useCallback(() => {
    if (pinInput === ADMIN_PIN) {
      setShowPinModal(false);
      setPinInput('');
      setPinError('');
      setAdminOverride(true);
      console.log('[Paywall] Admin override activated for this session');
      onDismiss?.();
    } else {
      setPinError('Incorrect PIN. Please try again.');
      setPinInput('');
    }
  }, [pinInput, setAdminOverride, onDismiss]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    const annual = offerings?.current?.annual;
    if (annual) {
      setSelectedPackage(annual);
    }
  }, [offerings]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const packages = offerings?.current?.availablePackages ?? [];
  const monthlyPkg = packages.find(p => p.packageType === 'MONTHLY' || p.identifier === '$rc_monthly');
  const annualPkg = packages.find(p => p.packageType === 'ANNUAL' || p.identifier === '$rc_annual');

  const getAnnualSavings = () => {
    if (!monthlyPkg || !annualPkg) return null;
    const monthlyPrice = monthlyPkg.product.price;
    const annualPrice = annualPkg.product.price;
    const annualEquivalent = monthlyPrice * 12;
    if (annualEquivalent <= 0) return null;
    const savings = Math.round(((annualEquivalent - annualPrice) / annualEquivalent) * 100);
    return savings > 0 ? savings : null;
  };

  const savings = getAnnualSavings();

  const { farmId } = useFarmData();

  const handleStartTrial = async () => {
    if (!farmId) {
      console.warn('[Paywall] farmId is empty, cannot start trial');
      Alert.alert('Error', 'Farm not loaded yet. Please try again in a moment.');
      return;
    }
    await startTrial(farmId);
  };

  const handlePurchase = async () => {
    if (!selectedPackage) return;
    try {
      const customerInfo = await purchasePackage(selectedPackage);
      console.log('[Paywall] Purchase completed, active entitlements:', Object.keys(customerInfo?.entitlements?.active ?? {}));
    } catch (err: unknown) {
      const error = err as { userCancelled?: boolean; message?: string };
      if (!error?.userCancelled) {
        Alert.alert('Purchase Failed', error?.message ?? 'Something went wrong. Please try again.');
      }
    }
  };

  const handleRestore = async () => {
    try {
      await restorePurchases();
      Alert.alert('Purchases Restored', 'Your subscription has been restored successfully.');
    } catch {
      Alert.alert('Restore Failed', 'Could not restore purchases. Please try again.');
    }
  };

  const getMonthlyEquivalent = (pkg: PurchasesPackage) => {
    const type = pkg.packageType;
    if (type === 'ANNUAL' || pkg.identifier === '$rc_annual') {
      return `$${(pkg.product.price / 12).toFixed(2)}/mo`;
    }
    return null;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.greenBand} />

      {onDismiss && (
        <TouchableOpacity style={[styles.closeBtn, { top: insets.top + 12 }]} onPress={onDismiss} testID="paywall-close">
          <X size={20} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View style={[styles.heroSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.iconRing}>
            <Shield size={36} color="#FFFFFF" strokeWidth={1.5} />
          </View>
          <TouchableOpacity onPress={handleAppNameTap} activeOpacity={1} hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}>
            <Text style={styles.appName}>FarmGuard</Text>
          </TouchableOpacity>
          <Text style={styles.headline}>Keep Every Machine{'\n'}Running at Peak.</Text>
          <Text style={styles.subheadline}>
            Full access to equipment tracking, maintenance logs, inventory, and more.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.featuresCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {FEATURES.map(({ icon: Icon, text }, i) => (
            <View key={i} style={[styles.featureRow, i < FEATURES.length - 1 && styles.featureRowBorder]}>
              <View style={styles.featureIconWrap}>
                <Icon size={16} color="#367C2B" strokeWidth={2} />
              </View>
              <Text style={styles.featureText}>{text}</Text>
              <Check size={14} color="#27AE60" strokeWidth={2.5} />
            </View>
          ))}
        </Animated.View>

        {isLoadingOfferings ? (
          <View style={styles.loadingPackages}>
            <ActivityIndicator color="#367C2B" />
          </View>
        ) : (
          <Animated.View style={[styles.packagesSection, { opacity: fadeAnim }]}>
            <Text style={styles.sectionLabel}>Choose Your Plan</Text>
            <View style={styles.packages}>
              {annualPkg && (
                <Animated.View style={[{ transform: [{ scale: selectedPackage?.identifier === annualPkg.identifier ? pulseAnim : new Animated.Value(1) }] }]}>
                  <TouchableOpacity
                    style={[
                      styles.packageCard,
                      styles.packageCardAnnual,
                      selectedPackage?.identifier === annualPkg.identifier && styles.packageCardSelected,
                    ]}
                    onPress={() => setSelectedPackage(annualPkg)}
                    activeOpacity={0.85}
                    testID="package-annual"
                  >
                    {savings !== null && (
                      <View style={styles.savingsBadge}>
                        <Text style={styles.savingsBadgeText}>Save {savings}%</Text>
                      </View>
                    )}
                    <View style={styles.packageTop}>
                      <View style={[
                        styles.radio,
                        selectedPackage?.identifier === annualPkg.identifier && styles.radioSelected,
                      ]}>
                        {selectedPackage?.identifier === annualPkg.identifier && (
                          <View style={styles.radioDot} />
                        )}
                      </View>
                      <View style={styles.packageInfo}>
                        <Text style={styles.packageName}>Yearly</Text>
                        <Text style={styles.packageEquivalent}>{getMonthlyEquivalent(annualPkg)}</Text>
                      </View>
                      <Text style={styles.packagePrice}>
                        {annualPkg.product.priceString}
                        {'\n'}
                        <Text style={styles.packagePricePeriod}>/year</Text>
                      </Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              )}

              {monthlyPkg && (
                <TouchableOpacity
                  style={[
                    styles.packageCard,
                    selectedPackage?.identifier === monthlyPkg.identifier && styles.packageCardSelected,
                  ]}
                  onPress={() => setSelectedPackage(monthlyPkg)}
                  activeOpacity={0.85}
                  testID="package-monthly"
                >
                  <View style={styles.packageTop}>
                    <View style={[
                      styles.radio,
                      selectedPackage?.identifier === monthlyPkg.identifier && styles.radioSelected,
                    ]}>
                      {selectedPackage?.identifier === monthlyPkg.identifier && (
                        <View style={styles.radioDot} />
                      )}
                    </View>
                    <View style={styles.packageInfo}>
                      <Text style={styles.packageName}>Monthly</Text>
                      <Text style={styles.packageEquivalent}>Billed monthly</Text>
                    </View>
                    <Text style={styles.packagePrice}>
                      {monthlyPkg.product.priceString}
                      {'\n'}
                      <Text style={styles.packagePricePeriod}>/month</Text>
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        )}

        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={[styles.ctaButton, (isPurchasing || !selectedPackage) && styles.ctaButtonDisabled]}
            onPress={handlePurchase}
            disabled={isPurchasing || !selectedPackage}
            activeOpacity={0.88}
            testID="paywall-subscribe"
          >
            {isPurchasing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaText}>
                {selectedPackage ? `Start with ${selectedPackage.product.title || (selectedPackage.identifier === '$rc_annual' ? 'Yearly' : 'Monthly')}` : 'Select a Plan'}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.legalText}>
            Subscription renews automatically. Cancel anytime in your account settings.
          </Text>

          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestore}
            disabled={isRestoring}
            activeOpacity={0.7}
            testID="paywall-restore"
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color="#7F8C8D" />
            ) : (
              <>
                <RefreshCw size={13} color="#7F8C8D" />
                <Text style={styles.restoreText}>Restore Purchases</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.trialBtn}
            onPress={handleStartTrial}
            activeOpacity={0.7}
            testID="paywall-trial"
          >
            <Eye size={14} color="rgba(255,255,255,0.6)" />
            <Text style={styles.trialText}>Try Free Preview</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Hidden admin PIN modal */}
      <Modal
        visible={showPinModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPinModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.pinOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.pinModal}>
            <Text style={styles.pinTitle}>Enter PIN</Text>
            <TextInput
              style={styles.pinInput}
              value={pinInput}
              onChangeText={(t) => { setPinInput(t); setPinError(''); }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              autoFocus
              placeholder="••••"
              placeholderTextColor="#999"
              onSubmitEditing={handlePinSubmit}
            />
            {pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}
            <View style={styles.pinButtons}>
              <TouchableOpacity
                style={styles.pinCancelBtn}
                onPress={() => { setShowPinModal(false); setPinInput(''); setPinError(''); }}
              >
                <Text style={styles.pinCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pinSubmitBtn, !pinInput && styles.pinSubmitDisabled]}
                onPress={handlePinSubmit}
                disabled={!pinInput}
              >
                <Text style={styles.pinSubmitText}>Unlock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A2E10',
  },
  greenBand: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1A2E10',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  iconRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#367C2B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  appName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFDE00',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  headline: {
    fontSize: 30,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subheadline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 22,
  },
  featuresCard: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
    gap: 12,
  },
  featureRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE8',
  },
  featureIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#EEF7EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '500' as const,
  },
  loadingPackages: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  packagesSection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
    marginLeft: 4,
  },
  packages: {
    gap: 10,
  },
  packageCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  packageCardAnnual: {
    backgroundColor: 'rgba(54, 124, 43, 0.25)',
  },
  packageCardSelected: {
    borderColor: '#FFDE00',
    backgroundColor: 'rgba(255, 222, 0, 0.08)',
  },
  savingsBadge: {
    position: 'absolute',
    top: -1,
    right: 16,
    backgroundColor: '#FFDE00',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  savingsBadgeText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: '#1A2E10',
    letterSpacing: 0.3,
  },
  packageTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#FFDE00',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFDE00',
  },
  packageInfo: {
    flex: 1,
  },
  packageName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  packageEquivalent: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
  },
  packagePrice: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    textAlign: 'right',
    lineHeight: 22,
  },
  packagePricePeriod: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: 'rgba(255,255,255,0.55)',
  },
  ctaSection: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  ctaButton: {
    backgroundColor: '#FFDE00',
    borderRadius: 16,
    paddingVertical: 17,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#FFDE00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: '#1A2E10',
    letterSpacing: 0.3,
  },
  legalText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  restoreText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  trialBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
  },
  trialText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    textDecorationLine: 'underline' as const,
  },
  pinOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  pinModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  pinTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1A2E10',
    marginBottom: 20,
  },
  pinInput: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#D5CFC5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    textAlign: 'center',
    color: '#1A1A1A',
    letterSpacing: 8,
    marginBottom: 8,
  },
  pinError: {
    fontSize: 13,
    color: '#E74C3C',
    marginBottom: 8,
    textAlign: 'center',
  },
  pinButtons: {
    flexDirection: 'row' as const,
    gap: 12,
    marginTop: 12,
    width: '100%',
  },
  pinCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D5CFC5',
    alignItems: 'center' as const,
  },
  pinCancelText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500' as const,
  },
  pinSubmitBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#367C2B',
    alignItems: 'center' as const,
  },
  pinSubmitDisabled: {
    opacity: 0.4,
  },
  pinSubmitText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
});
