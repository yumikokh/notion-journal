import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { BookOpen, MessagesSquare, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const glassOk = isLiquidGlassAvailable();

/**
 * Height of the floating bottom bar. The diary tab's floating pen button
 * uses the same value so the two sit as one row of equal-sized glass
 * (see BOTTOM_BAR_HEIGHT usage in calendar-screen's FAB).
 */
export const BOTTOM_BAR_HEIGHT = 56;

const TAB_CONFIG: Record<string, { label: string; Icon: LucideIcon }> = {
  index: { label: '日記', Icon: BookOpen },
  reflect: { label: 'ふりかえり', Icon: MessagesSquare },
};

/**
 * Structural subset of react-navigation's BottomTabBarProps — the package
 * isn't a direct dependency (expo-router vendors it), so we type only what
 * the glass bar actually reads.
 */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    navigate: (name: string) => void;
    emit: (event: { type: string; target?: string; canPreventDefault?: boolean }) => {
      defaultPrevented: boolean;
    };
  };
};

/**
 * Bottom navigation: a left-aligned glass capsule in the iOS 26 tab-bar
 * style — icon above label, selected tab highlighted by a bright lens pill.
 * The system tab bar can't be left-aligned (UIKit owns its layout), so this
 * is a custom bar built on the same public glass material (UIGlassEffect
 * via expo-glass-effect), the way left-aligned bottom bars in other apps
 * are done. The diary tab's floating pen (same size) completes the row on
 * the right. 設定 lives in the diary header's submenu, not a tab.
 */
export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <GlassTabBar {...(props as unknown as TabBarProps)} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="reflect" />
    </Tabs>
  );
}

function GlassTabBar({ state, navigation }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === 'dark';
  // The system tab bar's selection lens: near-white in light mode, a light
  // wash in dark mode — never the app's tinted background color.
  const lensColor = dark ? 'rgba(255,255,255,0.18)' : '#FFFFFF';

  return (
    <View
      pointerEvents="box-none"
      style={[styles.barRow, { bottom: insets.bottom + Spacing.two }]}>
      <GlassView
        glassEffectStyle="regular"
        style={[styles.capsule, !glassOk && { backgroundColor: theme.backgroundElement }]}>
        {state.routes.map((route, index) => {
          const config = TAB_CONFIG[route.name];
          if (!config) return null;
          const selected = state.index === index;
          const color = selected ? theme.accent : theme.textSecondary;
          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!selected && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[
                styles.tab,
                selected && [styles.tabSelected, { backgroundColor: lensColor }],
              ]}>
              <config.Icon size={20} color={color} strokeWidth={selected ? 2.2 : 1.8} />
              <ThemedText style={[styles.tabLabel, { color }]}>{config.label}</ThemedText>
            </Pressable>
          );
        })}
      </GlassView>
    </View>
  );
}

const styles = StyleSheet.create({
  barRow: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BOTTOM_BAR_HEIGHT,
    borderRadius: BOTTOM_BAR_HEIGHT / 2,
    paddingHorizontal: 5,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    height: BOTTOM_BAR_HEIGHT - 10,
    borderRadius: (BOTTOM_BAR_HEIGHT - 10) / 2,
    paddingHorizontal: Spacing.four,
  },
  tabSelected: {
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '600',
  },
});
