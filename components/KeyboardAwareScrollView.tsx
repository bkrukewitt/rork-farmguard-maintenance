import React, { useCallback, useRef, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Keyboard,
  Pressable,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextInput,
  EmitterSubscription,
} from 'react-native';

interface KeyboardAwareScrollViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  scrollViewStyle?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
  showsVerticalScrollIndicator?: boolean;
  stickyFooter?: React.ReactNode;
  extraScrollHeight?: number;
  dismissOnPress?: boolean;
}

export default function KeyboardAwareScrollView({
  children,
  style,
  contentContainerStyle,
  scrollViewStyle,
  keyboardVerticalOffset = Platform.OS === 'ios' ? 100 : 30,
  showsVerticalScrollIndicator = false,
  stickyFooter,
  extraScrollHeight = 120,
  dismissOnPress = true,
}: KeyboardAwareScrollViewProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const dismissKeyboard = useCallback(() => {
    if (dismissOnPress) {
      Keyboard.dismiss();
    }
  }, [dismissOnPress]);

  const scrollToFocusedInput = useCallback(() => {
    setTimeout(() => {
      const currentlyFocused = TextInput.State.currentlyFocusedInput?.();
      if (!currentlyFocused || !scrollViewRef.current) return;

      if (typeof currentlyFocused.measureLayout === 'function') {
        currentlyFocused.measureLayout(
          scrollViewRef.current as any,
          (_x: number, y: number, _w: number, h: number) => {
            scrollViewRef.current?.scrollTo({
              y: Math.max(0, y - extraScrollHeight + h),
              animated: true,
            });
          },
          () => {
            console.log('KeyboardAwareScrollView: measureLayout failed');
          }
        );
      }
    }, 50);
  }, [extraScrollHeight]);

  useEffect(() => {
    const subs: EmitterSubscription[] = [];

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    subs.push(
      Keyboard.addListener(showEvent, () => {
        setKeyboardVisible(true);
        scrollToFocusedInput();
      })
    );

    subs.push(
      Keyboard.addListener(hideEvent, () => {
        setKeyboardVisible(false);
      })
    );

    return () => {
      subs.forEach(s => s.remove());
    };
  }, [scrollToFocusedInput]);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <Pressable style={styles.flex} onPress={dismissKeyboard}>
        <ScrollView
          ref={scrollViewRef}
          style={[styles.flex, scrollViewStyle]}
          contentContainerStyle={[
            contentContainerStyle,
            keyboardVisible && { paddingBottom: extraScrollHeight + 100 },
          ]}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={() => {}}
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
