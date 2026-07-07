import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { BookOpen, MessagesSquare, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const glassOk = isLiquidGlassAvailable();
const BAR_HEIGHT = 60;

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
 * Bottom navigation, iOS 26 tab-bar style: one liquid-glass capsule holds
 * every tab (icon above label), and the selected tab is highlighted by a
 * bright lens pill inside the capsule — mirroring the system look where a
 * standalone glass circle (here: the diary tab's floating pen) sits to the
 * right. 設定 lives in the diary header's submenu, not a tab.
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
                selected && [styles.tabSelected, { backgroundColor: theme.background }],
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
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    paddingHorizontal: Spacing.one,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: BAR_HEIGHT - Spacing.one * 2,
    borderRadius: (BAR_HEIGHT - Spacing.one * 2) / 2,
    paddingHorizontal: Spacing.four,
  },
  tabSelected: {
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '600',
  },
});
