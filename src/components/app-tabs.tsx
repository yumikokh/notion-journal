import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * Bottom tab bar: 日記 / ふりかえり + the detached きろく circle — all the
 * system tab bar (genuine Liquid Glass).
 *
 * The trailing circle is the iOS 26 `role="search"` treatment: the system
 * splits that tab out of the main pill into its own glass circle (the
 * Slack-style layout), which is the only standard-conformant way to get a
 * leading pill + trailing action. きろく opens the quick-capture surface
 * with the input focused. 設定 lives in the diary header's submenu.
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

      <NativeTabs.Trigger name="capture" role="search">
        <NativeTabs.Trigger.Icon sf="square.and.pencil" />
        <NativeTabs.Trigger.Label>きろく</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
