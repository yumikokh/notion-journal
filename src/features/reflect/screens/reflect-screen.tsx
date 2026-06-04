import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isSupabaseEnvConfigured } from '@/lib/env';

import { AnalysisResult } from '../components/analysis-result';
import { WeekPicker } from '../components/week-picker';
import { useWeeklyAnalysis } from '../use-weekly-analysis';
import { getWeekRange, isSameWeek, shiftWeek, type WeekRange } from '../week-range';

export function ReflectScreen() {
  const theme = useTheme();
  const envOk = isSupabaseEnvConfigured();
  const today = useMemo(() => new Date(), []);
  const currentWeek = useMemo(() => getWeekRange(today), [today]);
  const [range, setRange] = useState<WeekRange>(currentWeek);

  // Track every week the user has explicitly asked to analyze. Switching
  // away and back shows the cached result instantly; brand-new weeks
  // require a fresh tap on "分析する" to avoid spending Claude calls when
  // the user is just browsing.
  const [analyzedWeeks, setAnalyzedWeeks] = useState<Set<string>>(new Set());
  const wasAnalyzed = analyzedWeeks.has(range.start);

  const query = useWeeklyAnalysis(range, envOk && wasAnalyzed);

  const handleAnalyze = () => {
    setAnalyzedWeeks((prev) => {
      if (prev.has(range.start)) return prev;
      const next = new Set(prev);
      next.add(range.start);
      return next;
    });
  };

  const handleRegenerate = () => {
    query.refetch();
  };

  const canGoNext = !isSameWeek(range, currentWeek);

  if (!envOk) {
    return (
      <ScreenContainer>
        <View style={styles.empty}>
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
        refreshControl={
          wasAnalyzed && query.data ? (
            <RefreshControl refreshing={query.isFetching} onRefresh={handleRegenerate} />
          ) : undefined
        }>
        <WeekPicker
          range={range}
          today={today}
          canGoNext={canGoNext}
          onPrev={() => setRange((r) => shiftWeek(r, -1))}
          onNext={() => setRange((r) => shiftWeek(r, 1))}
        />

        {!wasAnalyzed ? (
          <View style={styles.cta}>
            <Pressable
              onPress={handleAnalyze}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: theme.text, opacity: pressed ? 0.7 : 1 },
              ]}>
              <ThemedText style={[styles.buttonText, { color: theme.background }]}>
                分析する
              </ThemedText>
            </Pressable>
            <ThemedText themeColor="textSecondary" type="small" style={styles.ctaHint}>
              指定週の Daily を集約して AI に投げます。1回 数秒〜十数秒。
            </ThemedText>
          </View>
        ) : query.isLoading || query.isFetching ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.text} />
            <ThemedText themeColor="textSecondary" type="small">
              分析中…
            </ThemedText>
          </View>
        ) : query.error ? (
          <View style={styles.errorBox}>
            <ThemedText style={{ color: '#d05545' }}>分析に失敗しました</ThemedText>
            <ThemedText themeColor="textSecondary" type="small" selectable>
              {query.error.message}
            </ThemedText>
            <Pressable
              onPress={handleRegenerate}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: theme.text, opacity: pressed ? 0.6 : 1 },
              ]}>
              <ThemedText>もう一度試す</ThemedText>
            </Pressable>
          </View>
        ) : query.data ? (
          <>
            <AnalysisResult
              analysis={query.data.analysis}
              dailyCount={query.data.source.dailyCount}
              calendarEventCount={query.data.source.calendarEventCount}
            />
            <Pressable
              onPress={handleRegenerate}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: theme.text, opacity: pressed ? 0.6 : 1 },
              ]}>
              <ThemedText>再生成</ThemedText>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingVertical: Spacing.three,
    gap: Spacing.four,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  cta: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  ctaHint: {
    textAlign: 'center',
  },
  button: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: 999,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    fontWeight: '600',
  },
  center: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  errorBox: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d05545',
  },
  secondaryButton: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: 1,
  },
});
