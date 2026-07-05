import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { FeelingTrendChart } from '@/features/insights/components/feeling-trend-chart';
import { HabitRateChart } from '@/features/insights/components/habit-rate-chart';
import { useTheme } from '@/hooks/use-theme';

import { useWeekInsights } from '../use-week-insights';
import type { WeekRange } from '../week-range';

type WeekInsightsProps = {
  range: WeekRange;
  today: Date;
};

/**
 * The selected week's raw data, shown alongside the AI reflection as its
 * supporting evidence: a per-day feeling line and habit achievement bars.
 * Hidden while loading or when the week has no records at all — the
 * reflection CTA already covers the empty state.
 */
export function WeekInsights({ range, today }: WeekInsightsProps) {
  const { data, isLoading } = useWeekInsights(range, today);

  if (isLoading || data.recordedDays === 0) return null;

  const habitSubtitle = data.elapsedDays < 7 ? `今日までの${data.elapsedDays}日` : undefined;

  return (
    <View style={styles.section}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
        この週のきろく
      </ThemedText>
      <Card title="気分のうごき">
        <FeelingTrendChart points={data.trend} />
      </Card>
      <Card title="習慣の達成" subtitle={habitSubtitle}>
        <HabitRateChart rates={data.habitRates} />
      </Card>
    </View>
  );
}

type CardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

function Card({ title, subtitle, children }: CardProps) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { borderColor: theme.backgroundSelected }]}>
      <View style={styles.cardHeader}>
        <ThemedText style={styles.cardTitle}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
  sectionLabel: {
    marginLeft: Spacing.one,
  },
  card: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.three,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
});
