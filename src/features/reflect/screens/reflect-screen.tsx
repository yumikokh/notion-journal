import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenContainer } from '@/components/screen-container';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useJournalRange } from '@/features/journal/use-journal-range';
import { useTheme } from '@/hooks/use-theme';
import { isSupabaseEnvConfigured } from '@/lib/env';

import { AnalysisResult } from '../components/analysis-result';
import { SavedReflection } from '../components/saved-reflection';
import { WeekInsights } from '../components/week-insights';
import { WeekPicker } from '../components/week-picker';
import { useSaveWeeklyAnalysis } from '../use-save-weekly-analysis';
import { useWeeklyAnalysis } from '../use-weekly-analysis';
import { useWeeklyReflection } from '../use-weekly-reflection';
import { listRecentWeeks, listWeeksSince, type WeekRange } from '../week-range';
import { hasSavedReflection } from '../weekly-reflection';

/** Fallback reach when the earliest-entry date is unknown (~2 years). */
const MAX_WEEKS_BACK = 104;

/**
 * Weekly reflection, one week per page — swiped horizontally like the
 * journal list. The range runs from the user's first journal entry to the
 * current week, so the picker's bound is the data itself rather than an
 * arbitrary window.
 */
export function ReflectScreen() {
  const envOk = isSupabaseEnvConfigured();
  const today = useMemo(() => new Date(), []);

  // Resolve the range before mounting the pager — its page indices must not
  // shift underneath the FlatList once rendered.
  const journalRange = useJournalRange({ enabled: envOk });
  /** Oldest → newest; the last entry is the current week. */
  const weeks = useMemo(
    () =>
      journalRange.data
        ? listWeeksSince(journalRange.data, today)
        : listRecentWeeks(today, MAX_WEEKS_BACK + 1),
    [journalRange.data, today],
  );

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

  if (journalRange.isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.empty}>
          <ActivityIndicator />
        </View>
      </ScreenContainer>
    );
  }

  // Keyed by the range start so a late change (e.g. backfilled history)
  // remounts the pager instead of shifting indices under it.
  return <ReflectPager key={weeks[0].start} weeks={weeks} today={today} />;
}

/** The swipeable pager over a fixed, already-resolved list of weeks. */
function ReflectPager({ weeks, today }: { weeks: WeekRange[]; today: Date }) {
  const [pageIndex, setPageIndex] = useState(weeks.length - 1);
  const [pageWidth, setPageWidth] = useState(0);
  const pagerRef = useRef<FlatList<WeekRange>>(null);

  // Track every week the user has explicitly asked to analyze. Weeks are
  // remembered here (not in page-local state) because the pager unmounts
  // far-away pages; swiping away and back must still show the cached result
  // instead of asking for another paid Claude call.
  const [analyzedWeeks, setAnalyzedWeeks] = useState<Set<string>>(new Set());
  const markAnalyzed = useCallback((start: string) => {
    setAnalyzedWeeks((prev) => {
      if (prev.has(start)) return prev;
      const next = new Set(prev);
      next.add(start);
      return next;
    });
  }, []);
  const clearAnalyzed = useCallback((start: string) => {
    setAnalyzedWeeks((prev) => {
      if (!prev.has(start)) return prev;
      const next = new Set(prev);
      next.delete(start);
      return next;
    });
  }, []);

  const goTo = useCallback(
    (index: number, animated: boolean) => {
      const clamped = Math.max(0, Math.min(weeks.length - 1, index));
      setPageIndex(clamped);
      pagerRef.current?.scrollToIndex({ index: clamped, animated });
    },
    [weeks.length],
  );

  // Keep the header in sync when the user swipes instead of using buttons.
  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageWidth <= 0) return;
      const index = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
      setPageIndex(Math.max(0, Math.min(weeks.length - 1, index)));
    },
    [pageWidth, weeks.length],
  );

  const renderPage = useCallback(
    ({ item }: { item: WeekRange }) => (
      <WeekPage
        range={item}
        today={today}
        width={pageWidth}
        wasAnalyzed={analyzedWeeks.has(item.start)}
        onAnalyze={markAnalyzed}
        onClearAnalyzed={clearAnalyzed}
      />
    ),
    [today, pageWidth, analyzedWeeks, markAnalyzed, clearAnalyzed],
  );

  return (
    // Custom shell without horizontal padding: the pager must span the full
    // screen width so pages flip edge-to-edge; each page carries its own
    // inner padding instead.
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <WeekPicker weeks={weeks} index={pageIndex} today={today} onSelect={goTo} />
        </View>

        <View
          style={styles.pagerContainer}
          onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}>
          {pageWidth > 0 && (
            <FlatList
              ref={pagerRef}
              horizontal
              pagingEnabled
              data={weeks}
              keyExtractor={(w) => w.start}
              renderItem={renderPage}
              getItemLayout={(_, index) => ({
                length: pageWidth,
                offset: pageWidth * index,
                index,
              })}
              initialScrollIndex={weeks.length - 1}
              onMomentumScrollEnd={onMomentumScrollEnd}
              showsHorizontalScrollIndicator={false}
              initialNumToRender={1}
              maxToRenderPerBatch={2}
              windowSize={3}
            />
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

type WeekPageProps = {
  range: WeekRange;
  today: Date;
  width: number;
  /** Whether the user already requested an AI analysis for this week. */
  wasAnalyzed: boolean;
  onAnalyze: (weekStart: string) => void;
  onClearAnalyzed: (weekStart: string) => void;
};

/** One swipeable page: a single week's reflection state machine. */
function WeekPage({
  range,
  today,
  width,
  wasAnalyzed,
  onAnalyze,
  onClearAnalyzed,
}: WeekPageProps) {
  const theme = useTheme();
  // The shell's SafeAreaView only covers the top edge (the pager spans the
  // full width/height), so the scroll content must clear the home indicator
  // and the floating tab bar itself.
  const insets = useSafeAreaInsets();

  const query = useWeeklyAnalysis(range, wasAnalyzed);
  const saveMutation = useSaveWeeklyAnalysis(range);

  // When the user hasn't run a fresh analysis this session, read back any
  // reflection already saved to Notion for this week so reopening the app
  // shows the saved KPT instead of forcing (and paying for) a re-analysis.
  const reflectionQuery = useWeeklyReflection(range, { enabled: !wasAnalyzed });
  const savedReflection =
    reflectionQuery.data && hasSavedReflection(reflectionQuery.data)
      ? reflectionQuery.data
      : null;

  // Reset the save state when the analysis changes underneath it — the user
  // regenerated — so a stale "保存済み" never lingers over a result that
  // hasn't actually been saved yet.
  useEffect(() => {
    saveMutation.reset();
    // saveMutation is stable across renders; only re-run when the result changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.dataUpdatedAt]);

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
    onClearAnalyzed(range.start);
    reflectionQuery.refetch();
  };

  return (
    <View style={{ width }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + BottomTabInset + Spacing.four },
        ]}
        refreshControl={
          // Pull-to-refresh re-reads the saved reflection from Notion (cheap)
          // and drops any unsaved AI analysis. It must NOT trigger the paid
          // Claude analysis — that stays behind the explicit buttons.
          <RefreshControl
            refreshing={reflectionQuery.isFetching}
            onRefresh={handlePullRefresh}
          />
        }>
        {!wasAnalyzed ? (
          reflectionQuery.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.text} />
            </View>
          ) : savedReflection ? (
            <>
              {/* Keyed by week so a remount cleanly resets its edit/collapse
                  state instead of syncing a prop change via an effect. */}
              <SavedReflection key={range.start} reflection={savedReflection} />
              <Pressable
                onPress={() => onAnalyze(range.start)}
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
                onPress={() => onAnalyze(range.start)}
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
              onPress={() => query.refetch()}
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
                onPress={() => query.refetch()}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  pagerContainer: {
    flex: 1,
  },
  scroll: {
    paddingTop: Spacing.two,
    gap: Spacing.four,
    // Page-local padding — the pager itself spans the full screen width.
    // (Bottom padding is added inline from the safe-area insets.)
    paddingHorizontal: Spacing.four,
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
