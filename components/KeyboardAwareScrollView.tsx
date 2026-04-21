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
  Dimensions,
  KeyboardEvent,
  View,
  LayoutChangeEvent,
  NativeSyntheticEvent,
  NativeScrollEvent,
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
  keyboardVerticalOffset,
  showsVerticalScrollIndicator = false,
  stickyFooter,
  extraScrollHeight = 24,
  dismissOnPress = true,
}: KeyboardAwareScrollViewProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const [footerHeight, setFooterHeight] = useState<number>(0);
  const keyboardHeightRef = useRef<number>(0);
  const footerHeightRef = useRef<number>(0);
  const currentScrollY = useRef<number>(0);

  const dismissKeyboard = useCallback(() => {
    if (dismissOnPress) {
      Keyboard.dismiss();
    }
  }, [dismissOnPress]);

  const scrollToFocusedInput = useCallback(() => {
    if (Platform.OS === 'web') return;
    setTimeout(() => {
      const currentlyFocused = TextInput.State.currentlyFocusedInput?.();
      const scrollNode = scrollViewRef.current;
      if (!currentlyFocused || !scrollNode) return;

      if (typeof currentlyFocused.measureInWindow !== 'function') return;

      currentlyFocused.measureInWindow((_x: number, y: number, _w: number, h: number) => {
        if (typeof y !== 'number' || typeof h !== 'number') return;
        const screenHeight = Dimensions.get('window').height;
        const kbHeight = keyboardHeightRef.current;
        const footerH = footerHeightRef.current;
        const keyboardTop = kbHeight > 0 ? screenHeight - kbHeight : screenHeight;
        const inputBottom = y + h;
        const safeBottom = keyboardTop - (kbHeight > 0 ? 0 : footerH) - extraScrollHeight;

        if (inputBottom > safeBottom) {
          const delta = inputBottom - safeBottom;
          scrollNode.scrollTo({
            y: Math.max(0, currentScrollY.current + delta),
            animated: true,
          });
        }
      });
    }, Platform.OS === 'ios' ? 50 : 200);
  }, [extraScrollHeight]);

  useEffect(() => {
    const subs: EmitterSubscription[] = [];

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const changeEvent = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidChangeFrame';

    const onShow = (e: KeyboardEvent) => {
      const h = e?.endCoordinates?.height ?? 0;
      setKeyboardHeight(h);
      keyboardHeightRef.current = h;
      scrollToFocusedInput();
    };

    const onHide = () => {
      setKeyboardHeight(0);
      keyboardHeightRef.current = 0;
    };

    subs.push(Keyboard.addListener(showEvent, onShow));
    subs.push(Keyboard.addListener(hideEvent, onHide));
    subs.push(Keyboard.addListener(changeEvent, onShow));

    return () => {
      subs.forEach(s => s.remove());
    };
  }, [scrollToFocusedInput]);

  const onFooterLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setFooterHeight(h);
    footerHeightRef.current = h;
  }, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    currentScrollY.current = e.nativeEvent.contentOffset.y;
  }, []);

  const keyboardVisible = keyboardHeight > 0;
  const bottomPadding = keyboardVisible
    ? keyboardHeight + extraScrollHeight + 80
    : footerHeight + 20;

  const verticalOffset = keyboardVerticalOffset ?? 0;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={verticalOffset}
    >
      <Pressable style={styles.flex} onPress={dismissKeyboard}>
        <ScrollView
          ref={scrollViewRef}
          style={[styles.flex, scrollViewStyle]}
          contentContainerStyle={[
            contentContainerStyle,
            { paddingBottom: bottomPadding },
          ]}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          scrollEventThrottle={16}
          onScroll={onScroll}
        >
          {children}
        </ScrollView>
      </Pressable>
      {stickyFooter ? (
        <View onLayout={onFooterLayout}>{stickyFooter}</View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
