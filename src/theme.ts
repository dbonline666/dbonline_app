import type {Theme} from '@react-navigation/native';
import {DefaultTheme, DarkTheme} from '@react-navigation/native';

export const palette = {
  neutral50: '#f8fafc',
  neutral100: '#f1f5f9',
  neutral200: '#e2e8f0',
  neutral300: '#cbd5e1',
  neutral500: '#64748b',
  neutral700: '#334155',
  neutral800: '#1e293b',
  neutral900: '#0f172a',
  neutral950: '#020617',
  blue600: '#2563eb',
  blue700: '#1d4ed8',
  green600: '#16a34a',
  amber600: '#d97706',
  red600: '#dc2626',
  violet600: '#7c3aed',
  surfaceDark: '#111827',
  surfaceLight: '#ffffff',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
};

export type EffectiveTheme = 'light' | 'dark';

export const getNavigationTheme = (mode: EffectiveTheme): Theme => {
  if (mode === 'dark') {
    return {
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        primary: palette.blue600,
        background: palette.neutral950,
        card: palette.neutral900,
        text: palette.neutral50,
        border: palette.neutral800,
        notification: palette.red600,
      },
    };
  }

  return {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: palette.blue600,
      background: palette.neutral50,
      card: palette.surfaceLight,
      text: palette.neutral900,
      border: palette.neutral200,
      notification: palette.red600,
    },
  };
};

export const appColors = (mode: EffectiveTheme) => ({
  mode,
  background: mode === 'dark' ? palette.neutral950 : palette.neutral50,
  surface: mode === 'dark' ? palette.neutral900 : palette.surfaceLight,
  elevated: mode === 'dark' ? palette.surfaceDark : palette.surfaceLight,
  text: mode === 'dark' ? palette.neutral50 : palette.neutral900,
  mutedText: mode === 'dark' ? palette.neutral300 : palette.neutral500,
  border: mode === 'dark' ? palette.neutral800 : palette.neutral200,
  primary: palette.blue600,
  danger: palette.red600,
  success: palette.green600,
  warning: palette.amber600,
});

