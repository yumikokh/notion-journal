import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * Diameter shared by the diary tab's floating pen button so it lines up
 * with the system tab bar's height.
 */
export const BOTTOM_BAR_HEIGHT = 56;

/**
 * Bottom tab bar: 日記 / ふりかえり — the system tab bar.
 *
 * Deliberately NOT a custom bar: the genuine Liquid Glass tab bar (specular
 * edges, selection lens, scroll-driven minimize) only exists inside
 * UITabBarController; JS recreations read as flat frosted pills. UIKit owns
 * the bar's placement, so it stays centered — left-aligned bottom bars in
 * other apps are custom (and non-conformant) by definition.
 *
 * Quick capture is the diary tab's floating pen button, and 設定 lives in
 * the diary header's submenu.
 */
export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="book.closed.fill" />
        <NativeTabs.Trigger.Label>日記</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="reflect">
        <NativeTabs.Trigger.Icon sf="bubble.left.and.bubble.right.fill" />
        <NativeTabs.Trigger.Label>ふりかえり</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
