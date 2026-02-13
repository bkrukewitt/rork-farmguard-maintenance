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
    id: 'john-deere',
    name: 'John Deere',
    primary: '#367C2B',
    primaryLight: '#4A9A3A',
    primaryDark: '#2A5F21',
    secondary: '#FFDE00',
    secondaryLight: '#FFE633',
    accent: '#FFDE00',
    accentLight: '#FFE94D',
  },
  {
    id: 'case-ih',
    name: 'Case IH',
    primary: '#C41230',
    primaryLight: '#D4273F',
    primaryDark: '#9E0E26',
    secondary: '#1A1A1A',
    secondaryLight: '#333333',
    accent: '#FFFFFF',
    accentLight: '#F5F5F5',
  },
  {
    id: 'new-holland',
    name: 'New Holland',
    primary: '#003478',
    primaryLight: '#004A9E',
    primaryDark: '#002255',
    secondary: '#F5B324',
    secondaryLight: '#F7C24E',
    accent: '#F5B324',
    accentLight: '#F9D06A',
  },
  {
    id: 'kubota',
    name: 'Kubota',
    primary: '#F36F21',
    primaryLight: '#F5853E',
    primaryDark: '#D45A10',
    secondary: '#1A1A1A',
    secondaryLight: '#333333',
    accent: '#FFFFFF',
    accentLight: '#F5F5F5',
  },
  {
    id: 'massey-ferguson',
    name: 'Massey Ferguson',
    primary: '#CC0000',
    primaryLight: '#E60000',
    primaryDark: '#990000',
    secondary: '#808080',
    secondaryLight: '#999999',
    accent: '#FFFFFF',
    accentLight: '#F5F5F5',
  },
  {
    id: 'fendt',
    name: 'Fendt',
    primary: '#4A7729',
    primaryLight: '#5C9233',
    primaryDark: '#385C20',
    secondary: '#808080',
    secondaryLight: '#999999',
    accent: '#CC0000',
    accentLight: '#E63333',
  },
  {
    id: 'caterpillar',
    name: 'Caterpillar',
    primary: '#FFCD11',
    primaryLight: '#FFD633',
    primaryDark: '#E6B800',
    secondary: '#1A1A1A',
    secondaryLight: '#333333',
    accent: '#1A1A1A',
    accentLight: '#404040',
  },
  {
    id: 'claas',
    name: 'Claas',
    primary: '#8ABB26',
    primaryLight: '#9ECC3D',
    primaryDark: '#739E20',
    secondary: '#CC0000',
    secondaryLight: '#E63333',
    accent: '#CC0000',
    accentLight: '#E63333',
  },
  {
    id: 'agco',
    name: 'AGCO',
    primary: '#E31837',
    primaryLight: '#E8324A',
    primaryDark: '#C4142E',
    secondary: '#1A1A1A',
    secondaryLight: '#333333',
    accent: '#FFFFFF',
    accentLight: '#F5F5F5',
  },
  {
    id: 'versatile',
    name: 'Versatile',
    primary: '#FFD100',
    primaryLight: '#FFDA33',
    primaryDark: '#E6BC00',
    secondary: '#CC0000',
    secondaryLight: '#E63333',
    accent: '#CC0000',
    accentLight: '#E63333',
  },
];

const DEFAULT_SCHEME_ID = 'john-deere';

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
