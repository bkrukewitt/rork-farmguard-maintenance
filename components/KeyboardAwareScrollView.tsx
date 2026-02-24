import React, { useCallback } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Keyboard,
  Pressable,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';

interface KeyboardAwareScrollViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollViewStyle?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
  showsVerticalScrollIndicator?: boolean;
  stickyFooter?: React.ReactNode;
}

export default function KeyboardAwareScrollView({
  children,
  style,
  contentContainerStyle,
  scrollViewStyle,
  keyboardVerticalOffset = Platform.OS === 'ios' ? 100 : 0,
  showsVerticalScrollIndicator = false,
  stickyFooter,
}: KeyboardAwareScrollViewProps) {
  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <Pressable style={styles.flex} onPress={dismissKeyboard}>
        <ScrollView
          style={[styles.flex, scrollViewStyle]}
          contentContainerStyle={contentContainerStyle}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {children}
        </ScrollView>
      </Pressable>
      {stickyFooter}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
