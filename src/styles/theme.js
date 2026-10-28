import { Platform } from 'react-native';

/**
 * Ridingo Native Design Tokens
 * 100% translated from src/index.css CSS custom properties.
 */

export const LightTheme = {
  isDark: false,
  ground: '#DADADF',
  surface: '#F2F2F7',
  card: '#FFFFFF',
  sheet: '#FFFFFF',
  field: '#F2F2F7',
  ink: '#0B0B0C',
  muted: '#68686E',
  line: '#E5E5EA',
  lineStrong: '#C7C7CC',
  yellow: '#FFC70A',
  onYellow: '#15140F',
  yellowSoft: '#FFF3C4',
  chip: '#E6E6EB',
  bar: '#D8D8DD',
  solid: '#0B0B0C',
  onSolid: '#FFFFFF',
  bezel: '#0B0B0C',
  glass: 'rgba(249, 249, 251, 0.78)',
  glass2: 'rgba(255, 255, 255, 0.66)',
  meter: '#0C0C0E',
  meterDim: '#B3B3B8',
  switch: '#34C759',
  good: '#1E7D37',
  goodSoft: '#DDF4E4',
  warn: '#8F5800',
  warnSoft: '#FFEFC8',
  bad: '#D70015',
  badSoft: '#FFE5E7',
  bg: '#FFFFFF',
  onYellowSoft: '#855D00',
  accentGreen: '#10B981',
  accentGreenSoft: 'rgba(16, 185, 129, 0.15)',
};

export const DarkTheme = {
  isDark: true,
  ground: '#0A0A0B',
  surface: '#000000',
  card: '#1C1C1E',
  sheet: '#1C1C1E',
  field: '#2C2C2E',
  ink: '#FFFFFF',
  muted: '#B8B8C4',
  line: '#2C2C2E',
  lineStrong: '#48484A',
  yellow: '#FFC70A',
  onYellow: '#000000',
  yellowSoft: 'rgba(255, 199, 10, 0.18)',
  chip: '#2C2C2E',
  bar: '#3A3A3C',
  solid: '#FFFFFF',
  onSolid: '#0B0B0C',
  bezel: '#1A1A1C',
  glass: 'rgba(24, 24, 26, 0.78)',
  glass2: 'rgba(44, 44, 48, 0.62)',
  meter: '#FFFFFF',
  meterDim: '#5C5C60',
  switch: '#30D158',
  good: '#34C759',
  goodSoft: 'rgba(52, 199, 89, 0.18)',
  warn: '#FF9F0A',
  warnSoft: 'rgba(255, 159, 10, 0.18)',
  bad: '#FF453A',
  badSoft: 'rgba(255, 69, 58, 0.18)',
  bg: '#0A0A0B',
  onYellowSoft: '#FFC70A',
  accentGreen: '#10B981',
  accentGreenSoft: 'rgba(16, 185, 129, 0.22)',
};

export const Typography = {
  fontDisplay: Platform.select({
    ios: 'Manrope',
    android: 'Manrope-Bold',
    default: 'Manrope',
  }),
  fontBody: Platform.select({
    ios: 'Manrope',
    android: 'Manrope-Regular',
    default: 'Manrope',
  }),
  fontMono: Platform.select({
    ios: 'DM Mono',
    android: 'DMMono-Medium',
    default: 'DM Mono',
  }),
  hero: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  title1: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  title2: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headline: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  bodyBold: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  tiny: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
};

export const Radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const Shadows = {
  card: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
    android: {
      elevation: 2,
    },
    default: {},
  }),
  floating: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    },
    android: {
      elevation: 6,
    },
    default: {},
  }),
  glowYellow: Platform.select({
    ios: {
      shadowColor: '#FFC70A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
    },
    android: {
      elevation: 4,
    },
    default: {},
  }),
  glowGreen: Platform.select({
    ios: {
      shadowColor: '#10B981',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
    },
    android: {
      elevation: 4,
    },
    default: {},
  }),
};
