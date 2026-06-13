import { Tabs } from "expo-router";
import { LayoutDashboard, Tractor, Wrench, Settings, Package, Shield } from "lucide-react-native";
import React from "react";
import { AdminAccessProvider, useAdminAccess } from "@/contexts/AdminAccessContext";
import { useTheme } from "@/contexts/ThemeContext";

function TabLayoutInner() {
  const { colors } = useTheme();
  const { isSuperAdmin, pinModal } = useAdminAccess();

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingTop: 4,
          },
          headerStyle: {
            backgroundColor: colors.primary,
          },
          headerTintColor: colors.textOnPrimary,
          headerTitleStyle: {
            fontWeight: '600' as const,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="equipment"
          options={{
            title: "Equipment",
            tabBarIcon: ({ color, size }) => <Tractor color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="maintenance"
          options={{
            title: "Maintenance",
            tabBarIcon: ({ color, size }) => <Wrench color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="inventory"
          options={{
            title: "Inventory",
            tabBarIcon: ({ color, size }) => <Package color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="admin"
          options={{
            title: "Admin",
            href: isSuperAdmin ? undefined : null,
            tabBarIcon: ({ color, size }) => <Shield color={color} size={size} />,
            tabBarActiveTintColor: isSuperAdmin ? colors.statusOverdue : colors.primary,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
          }}
        />
      </Tabs>
      {pinModal}
    </>
  );
}

export default function TabLayout() {
  return (
    <AdminAccessProvider>
      <TabLayoutInner />
    </AdminAccessProvider>
  );
}
