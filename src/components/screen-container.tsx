import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type ScreenContainerProps = {
  children: ReactNode;
};

/** Shared screen shell: themed background + safe-area padding. */
export function ScreenContainer({ children }: ScreenContainerProps) {
  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea}>{children}</SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
});
