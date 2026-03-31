import { Stack } from "expo-router";
import React from "react";
import { useTheme } from "@/contexts/ThemeContext";

/** Stack groups list / add / detail so Expo Router shows one tab, not three. */
export default function WorkOrdersStackLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.textOnPrimary,
        headerTitleStyle: { fontWeight: "600" as const },
        headerBackTitle: "Back",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Work Orders" }} />
      <Stack.Screen
        name="add"
        options={{ title: "Add Work Order", presentation: "modal" }}
      />
      <Stack.Screen name="[id]" options={{ title: "Work Order" }} />
    </Stack>
  );
}
