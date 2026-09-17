import { Stack, useRouter } from "expo-router";
import React from "react";
import { Platform, TouchableOpacity } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useTheme } from "@/contexts/ThemeContext";

/** Stack for list / add / detail; lives outside (tabs) so work orders are not a tab bar item. */
export default function WorkOrdersStackLayout() {
  const { colors } = useTheme();
  const router = useRouter();

  const goBackToApp = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)" as any);
  };

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.textOnPrimary,
        headerTitleStyle: { fontWeight: "600" as const },
        headerBackTitle: "Back",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Work Orders",
          headerLeft: () => (
            <TouchableOpacity
              onPress={goBackToApp}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{
                paddingHorizontal: Platform.OS === "ios" ? 4 : 0,
                marginRight: Platform.OS === "ios" ? 4 : 8,
              }}
            >
              <ChevronLeft color={colors.textOnPrimary} size={28} />
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="add"
        options={{ title: "Add Work Order", presentation: "modal" }}
      />
      <Stack.Screen name="[id]" options={{ title: "Work Order" }} />
    </Stack>
  );
}
