import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { OrganizationProvider, useOrganization } from "@/contexts/OrganizationContext";
import { FarmDataProvider } from "@/contexts/FarmDataContext";
import Colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: Infinity,
      gcTime: Infinity,
    },
  },
});

function AuthGate() {
  const { isAuthenticated, isGuest, isLoading: authLoading } = useAuth();
  const { hasOrganization, isLoading: orgLoading } = useOrganization();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (authLoading || orgLoading) {
      console.log("AuthGate: waiting for auth/org state");
      return;
    }
    if ((segments as string[]).length === 0) {
      console.log("AuthGate: segments not ready yet");
      return;
    }

    const inAuthGroup = segments[0] === ('(auth)' as string);
    const inOrgSetup = segments[0] === ('organization' as string) && segments[1] === ('setup' as string);

    console.log("AuthGate: evaluating route", {
      segments,
      isAuthenticated,
      isGuest,
      hasOrganization,
    });

    if (isGuest) {
      if (inAuthGroup || inOrgSetup) {
        console.log("AuthGate: guest redirecting to home");
        router.replace('/' as any);
      }
      return;
    }

    if (!isAuthenticated && !inAuthGroup) {
      console.log("AuthGate: redirecting to login - not authenticated");
      router.replace('/(auth)/login' as any);
    } else if (isAuthenticated && hasOrganization && (inAuthGroup || inOrgSetup)) {
      console.log("AuthGate: redirecting to home - authenticated with org");
      router.replace('/' as any);
    }
  }, [isAuthenticated, isGuest, hasOrganization, authLoading, orgLoading, segments, router]);

  return null;
}

function RootLayoutNav() {
  const { isLoading: authLoading } = useAuth();
  const { isLoading: orgLoading } = useOrganization();

  useEffect(() => {
    if (!authLoading && !orgLoading) {
      SplashScreen.hideAsync();
    }
  }, [authLoading, orgLoading]);

  if (authLoading || orgLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <AuthGate />
      <Stack
        screenOptions={{
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.textOnPrimary,
          headerTitleStyle: { fontWeight: '600' as const },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen
          name="organization/setup"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="organization/manage"
          options={{ title: "Manage Farm" }}
        />
        <Stack.Screen
          name="organization/audit-log"
          options={{ title: "Audit Log" }}
        />
        <Stack.Screen
          name="equipment/add"
          options={{ title: "Add Equipment", presentation: "modal" }}
        />
        <Stack.Screen
          name="equipment/[id]"
          options={{ title: "Equipment Details" }}
        />
        <Stack.Screen
          name="equipment/edit/[id]"
          options={{ title: "Edit Equipment", presentation: "modal" }}
        />
        <Stack.Screen
          name="maintenance/add"
          options={{ title: "Log Maintenance", presentation: "modal" }}
        />
        <Stack.Screen
          name="inventory/add"
          options={{ title: "Add Part", presentation: "modal" }}
        />
        <Stack.Screen
          name="inventory/[id]"
          options={{ title: "Part Details" }}
        />
        <Stack.Screen
          name="routines/index"
          options={{ title: "Service Routines" }}
        />
        <Stack.Screen
          name="routines/add"
          options={{ title: "New Routine", presentation: "modal" }}
        />
        <Stack.Screen
          name="routines/edit/[id]"
          options={{ title: "Edit Routine" }}
        />
        <Stack.Screen
          name="routines/service"
          options={{ title: "Service Routines" }}
        />
        <Stack.Screen
          name="routines/inspection"
          options={{ title: "Inspection Routines" }}
        />
        <Stack.Screen
          name="routines/add-inspection"
          options={{ title: "New Inspection Routine", presentation: "modal" }}
        />
        <Stack.Screen
          name="routines/edit-inspection/[id]"
          options={{ title: "Edit Inspection Routine" }}
        />
        <Stack.Screen
          name="maintenance/[id]"
          options={{ title: "Maintenance Details" }}
        />
        <Stack.Screen
          name="maintenance/edit/[id]"
          options={{ title: "Edit Maintenance", presentation: "modal" }}
        />
        <Stack.Screen
          name="equipment/import"
          options={{ title: "Import Equipment", presentation: "modal" }}
        />
        <Stack.Screen
          name="inventory/import"
          options={{ title: "Import Inventory", presentation: "modal" }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <OrganizationProvider>
            <FarmDataProvider>
              <RootLayoutNav />
            </FarmDataProvider>
          </OrganizationProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
});
