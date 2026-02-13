import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { FarmDataProvider } from "@/contexts/FarmDataContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Ensure queries refetch on mount to load data from AsyncStorage
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      // Data from AsyncStorage should be considered fresh
      staleTime: Infinity,
      gcTime: Infinity,
    },
  },
});

function RootLayoutNav() {
  const { colors } = useTheme();
  
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: colors.textOnPrimary,
        headerTitleStyle: { fontWeight: '600' as const },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="equipment/add"
        options={{
          title: "Add Equipment",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="equipment/[id]"
        options={{
          title: "Equipment Details",
        }}
      />
      <Stack.Screen
        name="equipment/edit/[id]"
        options={{
          title: "Edit Equipment",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="maintenance/add"
        options={{
          title: "Log Maintenance",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="inventory/add"
        options={{
          title: "Add Part",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="inventory/[id]"
        options={{
          title: "Part Details",
        }}
      />
      <Stack.Screen
        name="routines/index"
        options={{
          title: "Service Routines",
        }}
      />
      <Stack.Screen
        name="routines/add"
        options={{
          title: "New Routine",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="routines/edit/[id]"
        options={{
          title: "Edit Routine",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <FarmDataProvider>
            <RootLayoutNav />
          </FarmDataProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
