import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  Text,
  TextLayoutEvent,
  TextStyle,
  View,
  StyleProp,
} from 'react-native';

type TruncatableStatusTextProps = {
  label: string;
  value: string;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  color: string;
};

export default function TruncatableStatusText({
  label,
  value,
  numberOfLines = 2,
  style,
  color,
}: TruncatableStatusTextProps) {
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    setIsTruncated(false);
  }, [value]);

  const onTextLayout = useCallback(
    (event: TextLayoutEvent) => {
      const displayed = event.nativeEvent.lines.map((line) => line.text).join('');
      setIsTruncated(displayed.length < value.length);
    },
    [value],
  );

  const showFullText = useCallback(() => {
    Alert.alert(label, value);
  }, [label, value]);

  const text = (
    <Text
      style={[style, { color }]}
      numberOfLines={numberOfLines}
      onTextLayout={onTextLayout}
    >
      {value}
    </Text>
  );

  if (!isTruncated) {
    return <View style={styles.container}>{text}</View>;
  }

  return (
    <Pressable
      onPress={showFullText}
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityHint="Shows the full status text"
    >
      {text}
    </Pressable>
  );
}

const styles = {
  container: {
    flex: 1,
  },
};
