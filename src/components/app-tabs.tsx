import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/hooks/use-theme';

/**
 * Bottom tab bar: 日記 / ふりかえり / 設定 — the system tab bar (genuine
 * Liquid Glass), centered as UIKit lays it out. Quick capture is not a
 * tab: the diary screen shows a floating pen that presents the きろく
 * bottom sheet.
 */
export default function AppTabs() {
  const colors = useTheme();

  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      // Selected icon+label follow the palette accent (default is iOS blue).
      // The unselected (default) colors are declared too, but iOS 26's
      // liquid-glass tab bar currently ignores them and keeps its own
      // monochrome — kept for when the system honors them again.
      tintColor={colors.accent}
      iconColor={{ default: colors.textSecondary, selected: colors.accent }}
      labelStyle={{
        default: { color: colors.textSecondary },
        selected: { color: colors.accent },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="book.closed.fill" />
        <NativeTabs.Trigger.Label>日記</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="reflect">
        <NativeTabs.Trigger.Icon sf="bubble.left.and.bubble.right.fill" />
        <NativeTabs.Trigger.Label>ふりかえり</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gearshape.fill" />
        <NativeTabs.Trigger.Label>設定</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
