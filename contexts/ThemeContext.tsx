import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';

const STORAGE_KEY = 'farmguard_theme';

export type ColorScheme = {
  id: string;
  name: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  secondaryLight: string;
  accent: string;
  accentLight: string;
};

export const COLOR_SCHEMES: ColorScheme[] = [
  {
    id: 'forest',
    name: 'Forest Green',
    primary: '#2D5016',
    primaryLight: '#4A7C23',
    primaryDark: '#1E3A0F',
    secondary: '#8B4513',
    secondaryLight: '#A0522D',
    accent: '#E67E22',
    accentLight: '#F39C12',
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    primary: '#1565C0',
    primaryLight: '#1976D2',
    primaryDark: '#0D47A1',
    secondary: '#00838F',
    secondaryLight: '#0097A7',
    accent: '#FF6F00',
    accentLight: '#FF8F00',
  },
  {
    id: 'sunset',
    name: 'Sunset Orange',
    primary: '#E65100',
    primaryLight: '#EF6C00',
    primaryDark: '#BF360C',
    secondary: '#6D4C41',
    secondaryLight: '#795548',
    accent: '#FFC107',
    accentLight: '#FFD54F',
  },
  {
    id: 'berry',
    name: 'Berry',
    primary: '#7B1FA2',
    primaryLight: '#9C27B0',
    primaryDark: '#4A148C',
    secondary: '#C2185B',
    secondaryLight: '#D81B60',
    accent: '#00BCD4',
    accentLight: '#26C6DA',
  },
  {
    id: 'slate',
    name: 'Slate',
    primary: '#37474F',
    primaryLight: '#455A64',
    primaryDark: '#263238',
    secondary: '#546E7A',
    secondaryLight: '#607D8B',
    accent: '#26A69A',
    accentLight: '#4DB6AC',
  },
  {
    id: 'rust',
    name: 'Rust',
    primary: '#A1512E',
    primaryLight: '#BF6B3F',
    primaryDark: '#7D3E21',
    secondary: '#5D4037',
    secondaryLight: '#6D4C41',
    accent: '#D4A03D',
    accentLight: '#E4B44F',
  },
  {
    id: 'crimson',
    name: 'Crimson',
    primary: '#B71C1C',
    primaryLight: '#C62828',
    primaryDark: '#8E0000',
    secondary: '#4E342E',
    secondaryLight: '#5D4037',
    accent: '#FFB300',
    accentLight: '#FFC107',
  },
  {
    id: 'teal',
    name: 'Teal',
    primary: '#00695C',
    primaryLight: '#00796B',
    primaryDark: '#004D40',
    secondary: '#3E2723',
    secondaryLight: '#4E342E',
    accent: '#FF7043',
    accentLight: '#FF8A65',
  },
];

const DEFAULT_SCHEME_ID = 'forest';

async function loadTheme(): Promise<string> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (data) {
      console.log('Theme loaded:', data);
      return data;
    }
    return DEFAULT_SCHEME_ID;
  } catch (error) {
    console.error('Error loading theme:', error);
    return DEFAULT_SCHEME_ID;
  }
}

async function saveTheme(schemeId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, schemeId);
    console.log('Theme saved:', schemeId);
  } catch (error) {
    console.error('Error saving theme:', error);
    throw error;
  }
}

export const [ThemeProvider, useTheme] = createContextHook(() => {
  const queryClient = useQueryClient();

  const themeQuery = useQuery({
    queryKey: ['theme'],
    queryFn: loadTheme,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const setThemeMutation = useMutation({
    mutationFn: saveTheme,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['theme'] });
    },
  });

  const currentSchemeId = themeQuery.data ?? DEFAULT_SCHEME_ID;

  const currentScheme = useMemo(() => {
    return COLOR_SCHEMES.find(s => s.id === currentSchemeId) ?? COLOR_SCHEMES[0];
  }, [currentSchemeId]);

  const colors = useMemo(() => ({
    primary: currentScheme.primary,
    primaryLight: currentScheme.primaryLight,
    primaryDark: currentScheme.primaryDark,
    secondary: currentScheme.secondary,
    secondaryLight: currentScheme.secondaryLight,
    accent: currentScheme.accent,
    accentLight: currentScheme.accentLight,
    success: '#27AE60',
    warning: '#F39C12',
    danger: '#E74C3C',
    background: '#F5F1EB',
    surface: '#FFFFFF',
    surfaceAlt: '#EDE8E0',
    text: '#2C3E50',
    textSecondary: '#7F8C8D',
    textLight: '#BDC3C7',
    textOnPrimary: '#FFFFFF',
    border: '#D5CFC5',
    borderLight: '#E8E3DB',
    statusDue: '#F39C12',
    statusOverdue: '#E74C3C',
    statusOk: '#27AE60',
    cardShadow: 'rgba(0, 0, 0, 0.08)',
  }), [currentScheme]);

  const { mutate: setThemeMutate } = setThemeMutation;

  const setColorScheme = useCallback((schemeId: string) => {
    setThemeMutate(schemeId);
  }, [setThemeMutate]);

  return {
    currentSchemeId,
    currentScheme,
    colors,
    colorSchemes: COLOR_SCHEMES,
    setColorScheme,
    isLoading: themeQuery.isLoading,
  };
});
