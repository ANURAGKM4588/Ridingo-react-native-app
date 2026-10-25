import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle, Polyline, Line, Polygon } from 'react-native-svg';

/**
 * NativeIcon Component
 * Cross-platform Icon system supporting pure React Native iOS/Android (react-native-svg)
 * and Web (native SVG) with zero runtime warnings or property errors.
 */

const PATHS = {
  home: (c, sw) => (
    <>
      <Path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Polyline points="9 22 9 12 15 12 15 22" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  homeFilled: (c) => (
    <Path d="M12 2.1 2.5 9.5a1 1 0 0 0-.5.8V20a2 2 0 0 0 2 2h6v-7h4v7h6a2 2 0 0 0 2-2v-9.7a1 1 0 0 0-.5-.8L12 2.1z" fill={c} />
  ),
  grid: (c, sw) => (
    <>
      <Rect width="7" height="7" x="3" y="3" rx="1.5" stroke={c} strokeWidth={sw} fill="none" />
      <Rect width="7" height="7" x="14" y="3" rx="1.5" stroke={c} strokeWidth={sw} fill="none" />
      <Rect width="7" height="7" x="14" y="14" rx="1.5" stroke={c} strokeWidth={sw} fill="none" />
      <Rect width="7" height="7" x="3" y="14" rx="1.5" stroke={c} strokeWidth={sw} fill="none" />
    </>
  ),
  history: (c, sw) => (
    <>
      <Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 3v5h5" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 7v5l4 2" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  historyFilled: (c) => (
    <>
      <Circle cx="12" cy="12" r="9" fill={c} />
      <Path d="M12 7v5l3 2" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" fill="none" />
    </>
  ),
  wallet: (c, sw) => (
    <>
      <Path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 5v14a2 2 0 0 0 2 2h16v-5" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18 12a2 2 0 0 0 0 4h4v-4Z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  walletFilled: (c) => (
    <>
      <Path d="M21 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2h-5a3 3 0 0 1 0-6h5zm-2 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" fill={c} />
      <Circle cx="19" cy="13" r="1.2" fill="#FFFFFF" />
    </>
  ),
  user: (c, sw) => (
    <>
      <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="7" r="4" stroke={c} strokeWidth={sw} fill="none" />
    </>
  ),
  userFilled: (c) => (
    <>
      <Path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" fill={c} />
      <Circle cx="12" cy="7" r="4" fill={c} />
    </>
  ),
  bell: (c, sw) => (
    <>
      <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  pin: (c, sw) => (
    <>
      <Path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="10" r="3" stroke={c} strokeWidth={sw} fill="none" />
    </>
  ),
  pinFilled: (c) => (
    <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill={c} />
  ),
  briefcase: (c, sw) => (
    <>
      <Rect width="20" height="14" x="2" y="7" rx="2" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  work: (c, sw) => (
    <>
      <Rect width="20" height="14" x="2" y="7" rx="2" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  crosshair: (c, sw) => (
    <>
      <Circle cx="12" cy="12" r="10" stroke={c} strokeWidth={sw} fill="none" />
      <Line x1="22" y1="12" x2="18" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="6" y1="12" x2="2" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="12" y1="6" x2="12" y2="2" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="12" y1="22" x2="12" y2="18" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  target: (c, sw) => (
    <>
      <Circle cx="12" cy="12" r="10" stroke={c} strokeWidth={sw} fill="none" />
      <Line x1="22" y1="12" x2="18" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="6" y1="12" x2="2" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="12" y1="6" x2="12" y2="2" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="12" y1="22" x2="12" y2="18" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  map: (c, sw) => (
    <Path d="M14.1 2.2a2 2 0 0 0-1.8 0L8 4.3 3.6 2.1A2 2 0 0 0 1 3.9v15.2a2 2 0 0 0 1.1 1.8l4.9 2.4a2 2 0 0 0 1.8 0l4.3-2.1 4.4 2.2a2 2 0 0 0 2.6-1.8V6.4a2 2 0 0 0-1.1-1.8l-4.9-2.4zM8 4.3v15.2M16 2.5v15.2" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  car: (c, sw) => (
    <>
      <Path d="M5 17h14M4 14l2-6h12l2 6M3 14h18v4a1 1 0 0 1-1 1h-1a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H4a1 1 0 0 1-1-1v-4z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="7" cy="17" r="1.5" fill={c} />
      <Circle cx="17" cy="17" r="1.5" fill={c} />
    </>
  ),
  search: (c, sw) => (
    <>
      <Circle cx="11" cy="11" r="8" stroke={c} strokeWidth={sw} fill="none" />
      <Line x1="21" y1="21" x2="16.65" y2="16.65" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  chevronRight: (c, sw) => (
    <Polyline points="9 18 15 12 9 6" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  chevronLeft: (c, sw) => (
    <Polyline points="15 18 9 12 15 6" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  chevronDown: (c, sw) => (
    <Polyline points="6 9 12 15 18 9" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  arrowLeft: (c, sw) => (
    <>
      <Line x1="19" y1="12" x2="5" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Polyline points="12 19 5 12 12 5" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  check: (c, sw) => (
    <Polyline points="20 6 9 17 4 12" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  checkCircle: (c, sw) => (
    <>
      <Path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Polyline points="22 4 12 14.01 9 11.01" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  x: (c, sw) => (
    <>
      <Line x1="18" y1="6" x2="6" y2="18" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="6" y1="6" x2="18" y2="18" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  clock: (c, sw) => (
    <>
      <Circle cx="12" cy="12" r="9" stroke={c} strokeWidth={sw} fill="none" />
      <Path d="M12 7v5l3 2" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" />
    </>
  ),
  shield: (c, sw) => (
    <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  phone: (c, sw) => (
    <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  alert: (c, sw) => (
    <>
      <Path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="12" y1="9" x2="12" y2="13" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="12" y1="17" x2="12.01" y2="17" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  star: (c) => (
    <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill={c} />
  ),
  navigation: (c) => (
    <Polygon points="3 11 22 2 13 21 11 13 3 11" fill={c} />
  ),
  route: (c, sw) => (
    <>
      <Circle cx="6" cy="19" r="3" stroke={c} strokeWidth={sw} fill="none" />
      <Path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" />
      <Circle cx="18" cy="5" r="3" stroke={c} strokeWidth={sw} fill="none" />
    </>
  ),
  plane: (c, sw) => (
    <Path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 20.5 3c-1-1-3-.5-4.5 1L12.5 7.5 4.3 5.7c-.5-.1-.9.1-1.2.4l-.8.8c-.4.4-.3 1 .1 1.4l5.3 4.2-3.2 3.2-2.1-.5c-.3-.1-.7 0-.9.3l-.4.4c-.3.3-.2.8.2 1.1l2.4 1.8 1.8 2.4c.3.4.8.5 1.1.2l.4-.4c.3-.2.4-.6.3-.9l-.5-2.1 3.2-3.2 4.2 5.3c.4.4 1 .5 1.4.1l.8-.8c.3-.3.5-.7.4-1.2z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  sun: (c, sw) => (
    <>
      <Circle cx="12" cy="12" r="4" stroke={c} strokeWidth={sw} fill="none" />
      <Path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  moon: (c, sw) => (
    <Path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  calendar: (c, sw) => (
    <>
      <Rect width="18" height="18" x="3" y="4" rx="2" stroke={c} strokeWidth={sw} fill="none" />
      <Line x1="16" x2="16" y1="2" y2="6" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="8" x2="8" y1="2" y2="6" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="3" x2="21" y1="10" y2="10" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
  filter: (c, sw) => (
    <Polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  sliders: (c, sw) => (
    <>
      <Line x1="4" y1="21" x2="4" y2="14" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="4" y1="10" x2="4" y2="3" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="12" y1="21" x2="12" y2="12" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="12" y1="8" x2="12" y2="3" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="20" y1="21" x2="20" y2="16" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="20" y1="12" x2="20" y2="3" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="1" y1="14" x2="7" y2="14" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="9" y1="8" x2="15" y2="8" stroke={c} strokeWidth={sw} strokeLinecap="round" />
      <Line x1="17" y1="16" x2="23" y2="16" stroke={c} strokeWidth={sw} strokeLinecap="round" />
    </>
  ),
};

export default function NativeIcon({
  name = 'home',
  size = 24,
  color = '#0B0B0C',
  strokeWidth = 2,
  filled = false,
  style,
}) {
  const camelKey = String(name).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
  const key = filled && PATHS[`${camelKey}Filled`] ? `${camelKey}Filled` : (PATHS[name] ? name : camelKey);

  const renderIconContent = PATHS[key] || PATHS.home;
  const flattenedStyle = style ? StyleSheet.flatten(style) : undefined;

  if (Platform.OS === 'web') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={flattenedStyle}
      >
        {renderIconContent(color, strokeWidth)}
      </svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={flattenedStyle}>
      {renderIconContent(color, strokeWidth)}
    </Svg>
  );
}
