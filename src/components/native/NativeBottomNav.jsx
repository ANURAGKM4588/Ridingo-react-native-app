import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import NativeIcon from './NativeIcon';
import { LightTheme, DarkTheme, Radii, Shadows } from '../../styles/theme';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'trips', label: 'History', icon: 'history' },
  { id: 'wallet', label: 'Wallet', icon: 'wallet' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

export default function NativeBottomNav({
  activeTab = 'home',
  onSelectTab,
  isDark = false,
  visible = true,
}) {
  if (!visible) return null;

  const theme = isDark ? DarkTheme : LightTheme;
  const activeBg = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.07)';
  const containerBg = isDark ? 'rgba(22, 24, 30, 0.94)' : 'rgba(255, 255, 255, 0.94)';

  return (
    <View style={[styles.navContainer, { backgroundColor: containerBg }]}>
      {NAV_ITEMS.map((item) => {
        const isActive = activeTab === item.id;
        const iconColor = isActive ? theme.ink : theme.muted;
        const textColor = isActive ? theme.ink : theme.muted;

        return (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.navItem,
              isActive && [styles.activeNavItem, { backgroundColor: activeBg }],
            ]}
            activeOpacity={0.75}
            onPress={() => onSelectTab && onSelectTab(item.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={item.label}
          >
            <View style={styles.iconWrap}>
              <NativeIcon
                name={item.icon}
                size={21}
                color={iconColor}
                filled={isActive}
              />
            </View>
            <Text
              style={[
                styles.navLabel,
                {
                  color: textColor,
                  fontWeight: isActive ? '700' : '500',
                },
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  navContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginBottom: Platform.OS === 'ios' ? 14 : 10,
    height: 60,
    borderRadius: Radii.pill || 9999,
    paddingHorizontal: 6,
    borderWidth: 0,
    borderTopWidth: 0,
    ...Shadows.floating,
  },
  navItem: {
    flex: 1,
    height: 48,
    borderRadius: Radii.pill || 9999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  activeNavItem: {
    borderWidth: 0,
  },
  iconWrap: {
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    fontSize: 10,
    letterSpacing: -0.1,
    marginTop: 2,
  },
});
