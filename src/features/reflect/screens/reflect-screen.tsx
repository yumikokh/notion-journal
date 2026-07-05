import { useEffect, useMemo, useState } from 'react';
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
import { SavedReflection } from '../components/saved-reflection';
import { WeekInsights } from '../components/week-insights';
import { WeekPicker } from '../components/week-picker';
import { useSaveWeeklyAnalysis } from '../use-save-weekly-analysis';
import { useWeeklyAnalysis } from '../use-weekly-analysis';
import { useWeeklyReflection } from '../use-weekly-reflection';
import { getWeekRange, isSameWeek, shiftWeek, type WeekRange } from '../week-range';
import { hasSavedReflection } from '../weekly-reflection';

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
  const saveMutation = useSaveWeeklyAnalysis(range);

  // When the user hasn't run a fresh analysis this session, read back any
  // reflection already saved to Notion for this week so reopening the app
  // shows the saved KPT instead of forcing (and paying for) a re-analysis.
  const reflectionQuery = useWeeklyReflection(range, { enabled: envOk && !wasAnalyzed });
  const savedReflection =
    reflectionQuery.data && hasSavedReflection(reflectionQuery.data)
      ? reflectionQuery.data
      : null;

  // Reset the save state when the analysis changes underneath it — either the
  // user switched weeks or regenerated — so a stale "保存済み" never lingers
  // over a result that hasn't actually been saved yet.
  useEffect(() => {
    saveMutation.reset();
    // saveMutation is stable across renders; only re-run when the result changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, query.dataUpdatedAt]);

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

  const handleSave = () => {
    if (!query.data) return;
    saveMutation.mutate({
      analysis: query.data.analysis,
      dailyCount: query.data.source.dailyCount,
      calendarEventCount: query.data.source.calendarEventCount,
    });
  };

  const handlePullRefresh = () => {
    // Pull-to-refresh re-syncs the saved reflection from Notion and returns to
    // the saved view, dropping any unsaved AI analysis for this week. It must
    // NOT trigger a paid re-analysis — that stays behind the explicit buttons.
    setAnalyzedWeeks((prev) => {
      if (!prev.has(range.start)) return prev;
      const next = new Set(prev);
      next.delete(range.start);
      return next;
    });
    reflectionQuery.refetch();
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          // Pull-to-refresh re-reads the saved reflection from Notion (cheap)
          // and drops any unsaved AI analysis. It must NOT trigger the paid
          // Claude analysis — that stays behind the explicit buttons.
          <RefreshControl
            refreshing={reflectionQuery.isFetching}
            onRefresh={handlePullRefresh}
          />
        }>
        <WeekPicker
          range={range}
          today={today}
          canGoNext={canGoNext}
          onPrev={() => setRange((r) => shiftWeek(r, -1))}
          onNext={() => setRange((r) => shiftWeek(r, 1))}
        />

        {!wasAnalyzed ? (
          reflectionQuery.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.text} />
            </View>
          ) : savedReflection ? (
            <>
              {/* Keyed by week so switching weeks remounts the component,
                  cleanly resetting its edit/collapse state instead of
                  syncing a prop change via an effect. */}
              <SavedReflection key={range.start} reflection={savedReflection} />
              <Pressable
                onPress={handleAnalyze}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: theme.text, opacity: pressed ? 0.6 : 1 },
                ]}>
                <ThemedText>AIにもう一度つくってもらう</ThemedText>
              </Pressable>
            </>
          ) : (
            <View style={styles.cta}>
              <Pressable
                onPress={handleAnalyze}
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: theme.text, opacity: pressed ? 0.7 : 1 },
                ]}>
                <ThemedText style={[styles.buttonText, { color: theme.background }]}>
                  AIにふりかえりをつくってもらう
                </ThemedText>
              </Pressable>
              <ThemedText themeColor="textSecondary" type="small" style={styles.ctaHint}>
                この週の記録をもとに、AIがやさしくふりかえりをつくります（数秒〜十数秒）。
              </ThemedText>
            </View>
          )
        ) : query.isLoading || query.isFetching ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.text} />
            <ThemedText themeColor="textSecondary" type="small">
              AIがふりかえりをつくっています…
            </ThemedText>
          </View>
        ) : query.error ? (
          <View style={[styles.errorBox, { borderColor: theme.danger }]}>
            <ThemedText style={{ color: theme.danger }}>うまくつくれませんでした</ThemedText>
            <ThemedText themeColor="textSecondary" type="small" selectable>
              {query.error.message}
            </ThemedText>
            <Pressable
              onPress={handleRegenerate}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: theme.text, opacity: pressed ? 0.6 : 1 },
              ]}>
              <ThemedText>もう一度試してみる</ThemedText>
            </Pressable>
          </View>
        ) : query.data ? (
          <>
            <AnalysisResult
              analysis={query.data.analysis}
              dailyCount={query.data.source.dailyCount}
              calendarEventCount={query.data.source.calendarEventCount}
            />
            <View style={styles.actions}>
              <Pressable
                onPress={handleSave}
                disabled={saveMutation.isPending}
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: saveMutation.isSuccess ? theme.accent : theme.text,
                    opacity: pressed || saveMutation.isPending ? 0.7 : 1,
                  },
                ]}>
                <ThemedText style={[styles.buttonText, { color: theme.background }]}>
                  {saveMutation.isPending
                    ? '保存中…'
                    : saveMutation.isSuccess
                      ? 'Notionに保存済み ✓'
                      : 'Notionに保存する'}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={handleRegenerate}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  { borderColor: theme.text, opacity: pressed ? 0.6 : 1 },
                ]}>
                <ThemedText>つくり直す</ThemedText>
              </Pressable>
            </View>
            {saveMutation.error ? (
              <ThemedText
                themeColor="textSecondary"
                type="small"
                style={[styles.saveError, { color: theme.danger }]}
                selectable>
                保存に失敗しました: {saveMutation.error.message}
              </ThemedText>
            ) : null}
          </>
        ) : null}

        {/* The week's raw data sits under the reflection as its evidence:
            the AI's observations gain credibility next to the actual line. */}
        <WeekInsights range={range} today={today} />
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
  },
  secondaryButton: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: 1,
  },
  actions: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  saveError: {
    textAlign: 'center',
  },
});
