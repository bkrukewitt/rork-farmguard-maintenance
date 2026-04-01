import { Stack } from "expo-router";
import React from "react";
import { useTheme } from "@/contexts/ThemeContext";

/** Stack for list / add / detail; lives outside (tabs) so work orders are not a tab bar item. */
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
