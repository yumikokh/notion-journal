import { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isSupabaseEnvConfigured } from '@/lib/env';

import { FeelingTrendChart } from '../components/feeling-trend-chart';
import { HabitRateChart } from '../components/habit-rate-chart';
import { StreakCard } from '../components/streak-card';
import type { InsightsPeriod } from '../insights';
import { useInsights } from '../use-insights';

const PERIODS: { key: InsightsPeriod; label: string }[] = [
  { key: 'week', label: '週' },
  { key: 'month', label: '月' },
];

export function InsightsScreen() {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const envOk = isSupabaseEnvConfigured();
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = useState<InsightsPeriod>('week');
  // The selected pill pops white on a gray track in light mode, and a lighter
  // gray in dark mode (matching the native segmented-control feel).
  const selectedPill = scheme === 'dark' ? theme.backgroundSelected : theme.background;

  const { data, isLoading, isFetching, error, refetch } = useInsights(period, today, {
    enabled: envOk,
  });

  const trendSubtitle = period === 'week' ? '直近6週' : '直近6ヶ月';
  const formatMD = (key: string) => {
    const [, m, d] = key.split('-').map(Number);
    return `${m}/${d}`;
  };
  const { start, end, days } = data.habitWindow;
  const range = start === end ? formatMD(end) : `${formatMD(start)}–${formatMD(end)}`;
  const habitSubtitle = `${range}・${days}日`;

  if (!envOk) {
    return (
      <ScreenContainer>
        <View style={styles.center}>
          <ThemedText themeColor="textSecondary">
            Supabase の環境変数が未設定です。`.env.local` を確認してください。
          </ThemedText>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isFetching} onRefresh={refetch} />}>
        <View style={styles.topRow}>
          <ThemedText style={styles.pageTitle}>Insights</ThemedText>
          {/* 週 / 月 toggle */}
          <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
            {PERIODS.map(({ key, label }) => {
              const selected = period === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setPeriod(key)}
                  style={[
                    styles.segmentButton,
                    selected && { backgroundColor: selectedPill },
                  ]}>
                  <ThemedText
                    style={[
                      styles.segmentLabel,
                      { color: selected ? theme.text : theme.textSecondary },
                    ]}>
                    {label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {isLoading && data.recordedDays === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.text} />
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <ThemedText style={{ color: '#d05545' }}>読み込みに失敗しました</ThemedText>
            <ThemedText themeColor="textSecondary" type="small" selectable>
              {error.message}
            </ThemedText>
            <Pressable
              onPress={refetch}
              style={({ pressed }) => [
                styles.retry,
                { borderColor: theme.text, opacity: pressed ? 0.6 : 1 },
              ]}>
              <ThemedText>もう一度試す</ThemedText>
            </Pressable>
          </View>
        ) : (
          <>
            <Card title="ストリーク">
              <StreakCard streak={data.streak} last7={data.last7Recorded} />
            </Card>

            <Card title="Feeling 推移" subtitle={trendSubtitle}>
              <FeelingTrendChart points={data.trend} />
            </Card>

            <Card title="習慣達成率" subtitle={habitSubtitle}>
              <HabitRateChart rates={data.habitRates} />
            </Card>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
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
  scroll: {
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 3,
    gap: 3,
  },
  segmentButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: 999,
    minWidth: 56,
    alignItems: 'center',
  },
  segmentLabel: {
    fontSize: 15,
    fontWeight: '600',
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
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.five,
    flex: 1,
  },
  errorBox: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d05545',
  },
  retry: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: 1,
  },
});
