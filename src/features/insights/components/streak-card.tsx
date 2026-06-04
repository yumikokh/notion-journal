import { StyleSheet, useColorScheme, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { notionChipColor } from '@/features/notion/colors';
import { useTheme } from '@/hooks/use-theme';

import type { StreakInfo } from '../insights';

type StreakCardProps = {
  streak: StreakInfo;
  /** Recorded-or-not for the last 7 days; index 0 = 6 days ago, 6 = today. */
  last7: boolean[];
};

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

/**
 * Journal streak summary: the current consecutive run (the hero number, in a
 * warm streak tint), the longest run, and a 7-day dot strip for an at-a-glance
 * recent rhythm.
 */
export function StreakCard({ streak, last7 }: StreakCardProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const flame = notionChipColor('orange', scheme);

  // Label each of the last 7 dots with its weekday (index 6 = today).
  const todayWeekday = (new Date().getDay() + 6) % 7; // Mon=0..Sun=6
  const dotLabels = last7.map((_, i) => {
    const offset = 6 - i; // days before today
    return WEEKDAY_LABELS[(todayWeekday - offset + 7 * 2) % 7];
  });

  return (
    <View style={styles.container}>
      <View style={styles.headline}>
        <ThemedText style={styles.flame}>🔥</ThemedText>
        <View style={styles.numbers}>
          <View style={styles.numberRow}>
            <ThemedText style={[styles.number, { color: flame.text }]}>
              {streak.current}
            </ThemedText>
            <ThemedText style={styles.unit} themeColor="textSecondary">
              日連続
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            最長 {streak.longest}日
            {!streak.recordedToday && streak.current > 0 ? ' ・ 今日はまだ' : ''}
          </ThemedText>
        </View>
      </View>

      <View style={styles.dots}>
        {last7.map((recorded, i) => (
          <View key={i} style={styles.dotColumn}>
            <View
              style={[
                styles.dot,
                recorded
                  ? { backgroundColor: flame.text, borderColor: flame.text }
                  : { backgroundColor: 'transparent', borderColor: theme.backgroundSelected },
              ]}
            />
            <ThemedText style={styles.dotLabel} themeColor="textSecondary">
              {dotLabels[i]}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  headline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flame: {
    fontSize: 36,
  },
  numbers: {
    gap: 2,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  number: {
    fontSize: 44,
    fontWeight: '800',
    lineHeight: 48,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontSize: 15,
    marginBottom: 3,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dotColumn: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  dotLabel: {
    fontSize: 12,
  },
});
