import type {Theme} from '@react-navigation/native';
import {DefaultTheme, DarkTheme} from '@react-navigation/native';

export const palette = {
  bgDeep: '#030014',
  bgInk: '#07031b',
  bgCard: 'rgba(22, 22, 40, 0.72)',
  bgCardHover: 'rgba(30, 30, 50, 0.82)',
  glassBorder: 'rgba(255, 255, 255, 0.10)',
  glassShine: 'rgba(255, 255, 255, 0.05)',
  primaryNeon: '#00f3ff',
  secondaryNeon: '#bc13fe',
  accentNeon: '#ff0055',
  textMain: '#ffffff',
  textMuted: '#a0a0b0',
  textSecondary: '#cbd5e1',
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
  cyanSoft: 'rgba(0, 243, 255, 0.12)',
  purpleSoft: 'rgba(188, 19, 254, 0.12)',
  pinkSoft: 'rgba(255, 0, 85, 0.12)',
  greenSoft: 'rgba(74, 222, 128, 0.14)',
  amberSoft: 'rgba(255, 170, 0, 0.15)',
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
  sm: 4,
  md: 6,
  lg: 8,
};

export type EffectiveTheme = 'light' | 'dark';

export const getNavigationTheme = (mode: EffectiveTheme): Theme => {
  if (mode === 'dark') {
    return {
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        primary: palette.primaryNeon,
        background: palette.bgDeep,
        card: palette.bgInk,
        text: palette.textMain,
        border: palette.glassBorder,
        notification: palette.accentNeon,
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
  background: mode === 'dark' ? palette.bgDeep : palette.neutral50,
  surface: mode === 'dark' ? palette.bgCard : palette.surfaceLight,
  elevated: mode === 'dark' ? 'rgba(10, 10, 24, 0.88)' : palette.surfaceLight,
  text: mode === 'dark' ? palette.textMain : palette.neutral900,
  mutedText: mode === 'dark' ? palette.textMuted : palette.neutral500,
  secondaryText: mode === 'dark' ? palette.textSecondary : palette.neutral700,
  border: mode === 'dark' ? palette.glassBorder : palette.neutral200,
  primary: mode === 'dark' ? palette.primaryNeon : palette.blue600,
  secondary: mode === 'dark' ? palette.secondaryNeon : palette.violet600,
  accent: mode === 'dark' ? palette.accentNeon : palette.red600,
  danger: mode === 'dark' ? palette.accentNeon : palette.red600,
  success: mode === 'dark' ? '#4ade80' : palette.green600,
  warning: mode === 'dark' ? '#ffaa00' : palette.amber600,
  panel: mode === 'dark' ? palette.bgCard : 'rgba(255, 255, 255, 0.92)',
  panelStrong: mode === 'dark' ? 'rgba(14, 14, 30, 0.92)' : '#ffffff',
  panelHover: mode === 'dark' ? palette.bgCardHover : palette.neutral100,
  panelBorder: mode === 'dark' ? palette.glassBorder : 'rgba(15, 23, 42, 0.10)',
  inputBg: mode === 'dark' ? 'rgba(0, 0, 0, 0.24)' : '#ffffff',
  chipBg: mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : palette.neutral100,
  primarySoft: mode === 'dark' ? palette.cyanSoft : 'rgba(37, 99, 235, 0.10)',
  secondarySoft: mode === 'dark' ? palette.purpleSoft : 'rgba(124, 58, 237, 0.10)',
  accentSoft: mode === 'dark' ? palette.pinkSoft : 'rgba(220, 38, 38, 0.10)',
  successSoft: mode === 'dark' ? palette.greenSoft : 'rgba(22, 163, 74, 0.10)',
  warningSoft: mode === 'dark' ? palette.amberSoft : 'rgba(217, 119, 6, 0.12)',
  shadow: mode === 'dark' ? 'rgba(0, 0, 0, 0.38)' : 'rgba(15, 23, 42, 0.10)',
  glowPrimary: mode === 'dark' ? 'rgba(0, 243, 255, 0.35)' : 'rgba(37, 99, 235, 0.18)',
  glowSecondary: mode === 'dark' ? 'rgba(188, 19, 254, 0.32)' : 'rgba(124, 58, 237, 0.16)',
  glowAccent: mode === 'dark' ? 'rgba(255, 0, 85, 0.30)' : 'rgba(220, 38, 38, 0.16)',
  code: mode === 'dark' ? palette.secondaryNeon : palette.violet600,
});
