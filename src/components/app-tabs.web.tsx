import { Tabs } from 'expo-router';

/**
 * Web fallback for `app-tabs.tsx` (which uses iOS-only NativeTabs).
 * Renders a standard expo-router Tabs layout that works in the browser.
 *
 * Metro picks `.web.tsx` automatically when bundling for the `web` platform.
 */
export default function AppTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'カレンダー' }} />
      <Tabs.Screen name="reflect" options={{ title: 'ふりかえり' }} />
      <Tabs.Screen name="settings" options={{ title: '設定' }} />
    </Tabs>
  );
}
