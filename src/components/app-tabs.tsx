import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { BookOpen, MessagesSquare, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const glassOk = isLiquidGlassAvailable();

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
 * Bottom navigation: a left-aligned liquid-glass pill (日記 / ふりかえり).
 * The right side of the same row belongs to the diary tab's floating ＋
 * (quick capture), so the two read as one balanced bottom bar. 設定 has no
 * tab slot — it lives in the diary header's submenu.
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
    <View pointerEvents="box-none" style={[styles.barRow, { bottom: insets.bottom + Spacing.two }]}>
      <GlassView
        glassEffectStyle="regular"
        style={[styles.pill, !glassOk && { backgroundColor: theme.backgroundElement }]}>
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
              style={[styles.tab, selected && { backgroundColor: theme.accentSoft }]}>
              <config.Icon size={18} color={color} strokeWidth={selected ? 2.2 : 1.8} />
              <ThemedText type="smallBold" style={{ color }}>
                {config.label}
              </ThemedText>
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
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.one,
    borderRadius: Radius.xl + 8,
    overflow: 'hidden',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    height: 44,
    borderRadius: Radius.xl,
  },
});
