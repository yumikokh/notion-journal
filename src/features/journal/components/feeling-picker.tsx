import { Pressable, StyleSheet, View, useColorScheme } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { FEELINGS, FEELING_NOTION_COLORS, type Feeling } from '@/features/journal/draft';
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

/**
 * Mood gauge: FEELINGS is an ordered scale (best → worst), so it renders
 * as a compact track of five tinted dots instead of five large kaomoji
 * buttons. The selected dot grows to full color and its kaomoji shows as a
 * chip on the right; tapping the selected dot again clears the feeling.
 */
export function FeelingPicker({ value, onChange, colorMap }: FeelingPickerProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  const selectedChip = value
    ? notionChipColor(colorMap?.[value] ?? FEELING_NOTION_COLORS[value], scheme)
    : null;

  return (
    <View style={styles.row}>
      <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
        <View style={[styles.trackLine, { backgroundColor: theme.backgroundSelected }]} />
        {FEELINGS.map((feeling) => {
          const selected = value === feeling;
          const chip = notionChipColor(
            colorMap?.[feeling] ?? FEELING_NOTION_COLORS[feeling],
            scheme,
          );
          return (
            <Pressable
              key={feeling}
              accessibilityRole="button"
              accessibilityLabel={`Feeling ${feeling}`}
              accessibilityState={{ selected }}
              hitSlop={10}
              onPress={() => onChange(selected ? null : feeling)}
              style={styles.stop}>
              <View
                style={[
                  selected ? styles.dotSelected : styles.dot,
                  { backgroundColor: chip.background },
                  !selected && styles.dotIdle,
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View
        style={[
          styles.valueChip,
          { backgroundColor: selectedChip ? selectedChip.background : theme.backgroundElement },
        ]}>
        <ThemedText
          type="small"
          style={{
            color: selectedChip ? selectedChip.text : theme.textSecondary,
            fontWeight: '600',
          }}
          numberOfLines={1}>
          {value ?? '気分'}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  track: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 32,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
  },
  trackLine: {
    position: 'absolute',
    left: Spacing.three + 4,
    right: Spacing.three + 4,
    height: 2,
    borderRadius: 1,
  },
  stop: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 32,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotIdle: {
    opacity: 0.55,
  },
  dotSelected: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  valueChip: {
    minWidth: 64,
    height: 28,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
});
