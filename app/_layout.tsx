import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useNotificationTap } from '@/features/notifications/use-notification-tap';
import { useReminderSync } from '@/features/notifications/use-reminder-sync';
import { persistOptions, queryClient } from '@/lib/query-client';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <NotificationsBridge />
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="capture-sheet"
              options={{
                presentation: 'formSheet',
                // Two detents: compact composer, and "pulled up" — reaching
                // the tall detent morphs into today's full day drawer.
                sheetAllowedDetents: [0.45, 0.95],
                sheetGrabberVisible: true,
                sheetCornerRadius: 24,
              }}
            />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Hooks must live inside QueryClientProvider (useReminderSync reads the
 * client) so we extract a tiny child that does nothing visible.
 */
function NotificationsBridge() {
  useReminderSync();
  useNotificationTap();
  return null;
}
