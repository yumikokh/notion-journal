import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * Bottom tab bar: カレンダー / ふりかえり.
 * Quick capture is the calendar's floating ＋ button (not a tab), and 設定
 * has no tab slot — it's visited rarely, so it lives behind the calendar
 * header's gear.
 */
export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="calendar" />
        <NativeTabs.Trigger.Label>カレンダー</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="reflect">
        <NativeTabs.Trigger.Icon sf="bubble.left.and.bubble.right.fill" />
        <NativeTabs.Trigger.Label>ふりかえり</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

    </NativeTabs>
  );
}
