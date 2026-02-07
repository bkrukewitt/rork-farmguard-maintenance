import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { FarmDataProvider } from "@/contexts/FarmDataContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Colors from "@/constants/colors";
import { ActivityIndicator, View, StyleSheet } from "react-native";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 30000,
      gcTime: 300000,
    },
  },
});

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/auth');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.textOnPrimary,
        headerTitleStyle: { fontWeight: '600' as const },
      }}
    >
      <Stack.Screen name="auth" options={{ headerShown: false }} />
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
        <AuthProvider>
          <FarmDataProvider>
            <RootLayoutNav />
          </FarmDataProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
