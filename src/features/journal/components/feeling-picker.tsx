import { Pressable, StyleSheet, View, useColorScheme } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { FEELINGS, type Feeling } from '@/features/journal/draft';
import { notionChipColor } from '@/features/notion/colors';
import { useTheme } from '@/hooks/use-theme';
import type { NotionSelectColor } from '@/lib/supabase';

type FeelingPickerProps = {
  value: Feeling | null;
  onChange: (next: Feeling | null) => void;
  /**
   * Notion select color per feeling, learned from already-saved entries.
   * Options without a known color fall back to the Notion `default` palette.
   */
  colorMap?: Partial<Record<Feeling, NotionSelectColor | null>>;
};

export function FeelingPicker({ value, onChange, colorMap }: FeelingPickerProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <View style={styles.row}>
      {FEELINGS.map((feeling) => {
        const selected = value === feeling;
        const chip = notionChipColor(colorMap?.[feeling] ?? null, scheme);
        return (
          <Pressable
            key={feeling}
            accessibilityRole="button"
            accessibilityLabel={`Feeling ${feeling}`}
            accessibilityState={{ selected }}
            onPress={() => onChange(selected ? null : feeling)}
            style={[
              styles.button,
              {
                backgroundColor: selected ? chip.background : theme.backgroundElement,
              },
            ]}>
            <ThemedText
              type="default"
              style={{
                color: selected ? chip.text : theme.textSecondary,
                fontWeight: selected ? '600' : '400',
              }}>
              {feeling}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
});
