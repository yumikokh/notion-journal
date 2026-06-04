import { StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { habitIcon } from '@/features/journal/habit-icons';

import { habitColor } from '../insights-colors';
import type { HabitRate } from '../insights';

type HabitRateChartProps = {
  rates: HabitRate[];
};

/**
 * Per-habit achievement rate as horizontal bars. Each habit owns a hue (from
 * the Notion palette): a tinted track plus a saturated fill proportional to
 * `rate`, with the habit's Lucide glyph and the percentage.
 */
export function HabitRateChart({ rates }: HabitRateChartProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <View style={styles.list}>
      {rates.map((rate) => {
        const Icon = habitIcon(rate.key);
        const percent = Math.round(rate.rate * 100);
        const chip = habitColor(rate.key, scheme);
        return (
          <View
            key={rate.key}
            style={styles.row}
            accessibilityLabel={`${rate.label} ${percent}% (${rate.checked}/${rate.total})`}>
            <View style={styles.label}>
              <Icon size={17} color={chip.text} />
              <ThemedText style={styles.labelText}>{rate.label}</ThemedText>
            </View>
            <View style={[styles.track, { backgroundColor: chip.background }]}>
              <View
                style={[styles.fill, { backgroundColor: chip.text, width: `${percent}%` }]}
              />
            </View>
            <View style={styles.value}>
              <ThemedText style={[styles.percent, { color: chip.text }]}>{percent}%</ThemedText>
              <ThemedText style={styles.count} themeColor="textSecondary">
                {rate.checked}/{rate.total}
              </ThemedText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    width: 104,
  },
  labelText: {
    fontSize: 15,
    fontWeight: '500',
  },
  track: {
    flex: 1,
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  value: {
    width: 48,
    alignItems: 'flex-end',
  },
  percent: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  count: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
});
