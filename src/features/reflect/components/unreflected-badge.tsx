import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/**
 * Muted pill marking a week whose reflection hasn't been written yet — the
 * gentle nudge is on what's left to do; finished weeks stay unmarked.
 */
export function UnreflectedBadge() {
  const theme = useTheme();
  return (
    <View
      accessibilityLabel="ふりかえり未記入"
      style={[styles.badge, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText style={styles.text} themeColor="textSecondary">
        未記入
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  text: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
});
