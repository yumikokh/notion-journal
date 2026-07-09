import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** Small pill marking a week whose reflection is already saved to Notion. */
export function ReflectedBadge() {
  const theme = useTheme();
  return (
    <View
      accessibilityLabel="ふりかえり記入済"
      style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
      <ThemedText style={[styles.text, { color: theme.accent }]}>記入済</ThemedText>
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
