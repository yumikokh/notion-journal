import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LayoutList, SlidersHorizontal } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  useColorScheme,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { computeStreak } from '@/features/insights/insights';
import { buildMonthWeeks, type MonthCell } from '@/features/journal/build-month-grid';
import {
  DEFAULT_PREFS,
  loadCalendarPrefs,
  saveCalendarPrefs,
  type CalendarPrefs,
} from '@/features/journal/calendar-prefs';
import { DayDrawer } from '@/features/journal/components/day-drawer';
import {
  MonthSection,
  monthSectionHeight,
} from '@/features/journal/components/month-section';
import { FEELINGS, type Feeling } from '@/features/journal/draft';
import {
  COVER_TOGGLE_ICON,
  DIARY_TOGGLE_ICON,
  habitIcon,
} from '@/features/journal/habit-icons';
import { useMonthEntries } from '@/features/journal/use-month-entries';
import { notionChipColor } from '@/features/notion/colors';
import { useTheme } from '@/hooks/use-theme';
import { toDateKey } from '@/lib/date';
import { isSupabaseEnvConfigured } from '@/lib/env';
import type { MonthEntry, NotionSelectColor } from '@/lib/supabase';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
/** Cell height relative to width — taller than square so photos read well. */
const CELL_HEIGHT_RATIO = 1.4;
/** How far the continuous calendar reaches (months before/after today). */
const MONTHS_BACK = 24;
const MONTHS_FORWARD = 1;

type MonthItem = {
  key: string; // YYYY-MM
  year: number;
  month: number; // 0-indexed
  weeks: MonthCell[][];
};

/**
 * Continuous vertically-scrolling calendar: months stack seamlessly in a
 * FlatList (oldest at the top, tomorrow's month at the bottom), opening on
 * the current month. Every month section fetches its own entries lazily as
 * it enters the render window, so scrolling through years stays cheap.
 */
export function CalendarScreen() {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const envOk = isSupabaseEnvConfigured();
  const queryClient = useQueryClient();
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);

  const months = useMemo<MonthItem[]>(() => {
    const list: MonthItem[] = [];
    for (let offset = -MONTHS_BACK; offset <= MONTHS_FORWARD; offset++) {
      const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      list.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        year: d.getFullYear(),
        month: d.getMonth(),
        weeks: buildMonthWeeks(d.getFullYear(), d.getMonth()),
      });
    }
    return list;
  }, [today]);
  const currentMonthIndex = MONTHS_BACK;

  // Cells are sized off the measured list width (screen minus our own
  // horizontal padding). Floor to avoid sub-pixel rounding pushing the
  // 7th column past the container on iOS.
  const [gridWidth, setGridWidth] = useState(0);
  const cellWidth = gridWidth > 0 ? Math.floor(gridWidth / 7) : 0;
  const cellHeight = Math.round(cellWidth * CELL_HEIGHT_RATIO);

  const [prefs, setPrefs] = useState<CalendarPrefs>(DEFAULT_PREFS);
  useEffect(() => {
    loadCalendarPrefs().then(setPrefs);
  }, []);

  // Filter panel visibility — hidden by default behind the action button.
  const [showFilters, setShowFilters] = useState(false);

  const [drawerDate, setDrawerDate] = useState<string | null>(null);

  // Header label follows the topmost visible month while scrolling.
  const [visibleIndex, setVisibleIndex] = useState(currentMonthIndex);
  const visibleMonth = months[visibleIndex] ?? months[currentMonthIndex];

  const listRef = useRef<FlatList<MonthItem>>(null);

  /**
   * The current month's entries back the pieces that need a single sample
   * of the user's data (feeling → Notion color map for the day drawer,
   * habit names for the filter chips). The per-month grids fetch their own.
   */
  const currentYearMonth = months[currentMonthIndex].key;
  const currentEntries = useMonthEntries(currentYearMonth, { enabled: envOk });

  // Streak chip in the header. Two months of history cover any realistic
  // current run while reusing the calendar's own month cache; a streak
  // longer than that would display capped rather than fetching more.
  const prevEntries = useMonthEntries(months[currentMonthIndex - 1].key, { enabled: envOk });
  const streak = useMemo(() => {
    const dates = [...(prevEntries.data ?? []), ...(currentEntries.data ?? [])].map(
      (e: MonthEntry) => e.date,
    );
    return computeStreak(dates, today);
  }, [prevEntries.data, currentEntries.data, today]);

  const feelingColorMap = useMemo(() => {
    const m: Partial<Record<Feeling, NotionSelectColor | null>> = {};
    currentEntries.data?.forEach((e: MonthEntry) => {
      if (!e.feeling || !FEELINGS.includes(e.feeling as Feeling)) return;
      const key = e.feeling as Feeling;
      if (!(key in m)) m[key] = e.feelingColor;
    });
    return m;
  }, [currentEntries.data]);

  const habitNames = useMemo(() => {
    const seen: string[] = [];
    currentEntries.data?.forEach((e: MonthEntry) => {
      for (const name of Object.keys(e.habits ?? {})) {
        if (!seen.includes(name)) seen.push(name);
      }
    });
    return seen;
  }, [currentEntries.data]);

  const openDay = useCallback((dateKey: string) => {
    setDrawerDate(dateKey);
  }, []);
  const closeDrawer = useCallback(() => setDrawerDate(null), []);

  const scrollToMonth = useCallback(
    (year: number, month: number, animated: boolean) => {
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      const index = months.findIndex((m) => m.key === key);
      if (index >= 0) listRef.current?.scrollToIndex({ index, animated });
    },
    [months],
  );
  const scrollToToday = useCallback(() => {
    listRef.current?.scrollToIndex({ index: currentMonthIndex, animated: true });
  }, [currentMonthIndex]);

  // Deep link from a tapped reminder notification: `/(tabs)?date=YYYY-MM-DD`.
  // The URL is the external system here — when the param changes we mirror
  // it into local state (scroll position + drawer date) and then clear the
  // param so navigating back to the calendar tab doesn't re-trigger it.
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const router = useRouter();
  useEffect(() => {
    const raw = Array.isArray(params.date) ? params.date[0] : params.date;
    if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return;
    const [yearStr, monthStr] = raw.split('-');
    scrollToMonth(Number(yearStr), Number(monthStr) - 1, false);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing URL param into local UI state on change is exactly the subscription pattern.
    setDrawerDate(raw);
    router.setParams({ date: undefined });
  }, [params.date, router, scrollToMonth]);

  const updatePrefs = useCallback((mutate: (prev: CalendarPrefs) => CalendarPrefs) => {
    setPrefs((prev) => {
      const next = mutate(prev);
      saveCalendarPrefs(next).catch(() => {});
      return next;
    });
  }, []);

  const toggleHabit = useCallback(
    (name: string) =>
      updatePrefs((prev) => ({
        ...prev,
        habitOverlay: prev.habitOverlay.includes(name)
          ? prev.habitOverlay.filter((k) => k !== name)
          : [...prev.habitOverlay, name],
      })),
    [updatePrefs],
  );

  const toggleShowDiary = useCallback(
    () => updatePrefs((prev) => ({ ...prev, showDiary: !prev.showDiary })),
    [updatePrefs],
  );
  const toggleShowCover = useCallback(
    () => updatePrefs((prev) => ({ ...prev, showCover: !prev.showCover })),
    [updatePrefs],
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Refetch every mounted month at once (each section owns its query).
      await queryClient.invalidateQueries({ queryKey: ['journal', 'month'] });
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  // Precomputed per-month heights let getItemLayout answer synchronously,
  // which initialScrollIndex (jump straight to the current month) requires.
  const itemLayouts = useMemo(() => {
    let offset = 0;
    return months.map((m) => {
      const length = monthSectionHeight(m.weeks.length, cellHeight);
      const layout = { length, offset };
      offset += length;
      return layout;
    });
  }, [months, cellHeight]);
  const getItemLayout = useCallback(
    (_: ArrayLike<MonthItem> | null | undefined, index: number) => ({
      index,
      ...itemLayouts[index],
    }),
    [itemLayouts],
  );

  // FlatList requires the viewability pairs to keep the same identity across
  // renders — a lazy useState initializer gives us that without touching a
  // ref during render (setVisibleIndex is stable, so the closure stays valid).
  const [viewabilityConfigCallbackPairs] = useState(() => [
    {
      viewabilityConfig: { itemVisiblePercentThreshold: 25 },
      onViewableItemsChanged: ({ viewableItems }: { viewableItems: ViewToken[] }) => {
        const first = viewableItems.find((v) => v.isViewable && typeof v.index === 'number');
        if (first && first.index !== null) setVisibleIndex(first.index);
      },
    },
  ]);

  const renderMonth = useCallback(
    ({ item }: { item: MonthItem }) => (
      <MonthSection
        year={item.year}
        month={item.month}
        weeks={item.weeks}
        cellWidth={cellWidth}
        cellHeight={cellHeight}
        prefs={prefs}
        todayKey={todayKey}
        scheme={scheme}
        enabled={envOk}
        onDayPress={openDay}
      />
    ),
    [cellWidth, cellHeight, prefs, todayKey, scheme, envOk, openDay],
  );

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="subtitle">
            {visibleMonth.year}年{visibleMonth.month + 1}月
          </ThemedText>
          <View style={styles.headerActions}>
            {streak.current > 0 && (
              <View
                accessibilityLabel={`連続記録 ${streak.current}日`}
                style={[
                  styles.streakChip,
                  { backgroundColor: notionChipColor('orange', scheme).background },
                ]}>
                <ThemedText
                  type="smallBold"
                  style={{ color: notionChipColor('orange', scheme).text }}>
                  🔥{streak.current}
                </ThemedText>
              </View>
            )}
            {visibleIndex !== currentMonthIndex && (
              <Pressable
                onPress={scrollToToday}
                accessibilityRole="button"
                accessibilityLabel="今日へ移動"
                style={[styles.todayBtn, { backgroundColor: theme.accentSoft }]}>
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  今日
                </ThemedText>
              </Pressable>
            )}
            <Pressable
              onPress={() => router.push('/journal-list')}
              accessibilityRole="button"
              accessibilityLabel="日記の一覧"
              style={[styles.actionBtn, { backgroundColor: theme.backgroundElement }]}>
              <LayoutList size={16} color={theme.textSecondary} strokeWidth={1.8} />
            </Pressable>
            <Pressable
              onPress={() => setShowFilters((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel="表示項目"
              accessibilityState={{ expanded: showFilters }}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: showFilters
                    ? theme.backgroundSelected
                    : theme.backgroundElement,
                },
              ]}>
              <SlidersHorizontal size={16} color={theme.textSecondary} strokeWidth={1.8} />
            </Pressable>
          </View>
        </View>

        {showFilters && (
          <View style={styles.habitRow}>
            {habitNames.map((name) => {
              const on = prefs.habitOverlay.includes(name);
              const Icon = habitIcon(name);
              const iconColor = on ? theme.text : theme.textSecondary;
              return (
                <Pressable
                  key={name}
                  accessibilityRole="switch"
                  accessibilityLabel={`${name} をカレンダーに表示`}
                  accessibilityState={{ checked: on }}
                  onPress={() => toggleHabit(name)}
                  style={[
                    styles.chipToggle,
                    {
                      backgroundColor: on ? theme.backgroundSelected : theme.backgroundElement,
                    },
                  ]}>
                  <Icon size={14} color={iconColor} strokeWidth={1.8} />
                  <ThemedText type="small" themeColor={on ? 'text' : 'textSecondary'}>
                    {name}
                  </ThemedText>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: prefs.showDiary }}
              onPress={toggleShowDiary}
              style={[
                styles.chipToggle,
                {
                  backgroundColor: prefs.showDiary
                    ? theme.backgroundSelected
                    : theme.backgroundElement,
                },
              ]}>
              <DIARY_TOGGLE_ICON
                size={14}
                color={prefs.showDiary ? theme.text : theme.textSecondary}
                strokeWidth={1.8}
              />
              <ThemedText type="small" themeColor={prefs.showDiary ? 'text' : 'textSecondary'}>
                Diary
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: prefs.showCover }}
              onPress={toggleShowCover}
              style={[
                styles.chipToggle,
                {
                  backgroundColor: prefs.showCover
                    ? theme.backgroundSelected
                    : theme.backgroundElement,
                },
              ]}>
              <COVER_TOGGLE_ICON
                size={14}
                color={prefs.showCover ? theme.text : theme.textSecondary}
                strokeWidth={1.8}
              />
              <ThemedText type="small" themeColor={prefs.showCover ? 'text' : 'textSecondary'}>
                Cover
              </ThemedText>
            </Pressable>
          </View>
        )}

        {!envOk && (
          <View style={styles.statusRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Notion 未接続
            </ThemedText>
          </View>
        )}

        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((label, i) => (
            <ThemedText
              key={label}
              type="small"
              themeColor="textSecondary"
              style={[
                styles.weekdayLabel,
                i === 0 && { color: theme.holiday },
                i === 6 && { color: theme.saturday },
              ]}>
              {label}
            </ThemedText>
          ))}
        </View>

        <View
          style={styles.listContainer}
          onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
          {cellWidth > 0 && (
            <FlatList
              ref={listRef}
              data={months}
              keyExtractor={(m) => m.key}
              renderItem={renderMonth}
              getItemLayout={getItemLayout}
              initialScrollIndex={currentMonthIndex}
              viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
              initialNumToRender={3}
              maxToRenderPerBatch={3}
              windowSize={7}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.four }}
              refreshControl={
                envOk ? (
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={theme.textSecondary}
                  />
                ) : undefined
              }
            />
          )}
        </View>
      </SafeAreaView>
      <DayDrawer date={drawerDate} onClose={closeDrawer} feelingColors={feelingColorMap} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    // Slimmer than ScreenContainer's default so calendar cells get the width.
    paddingHorizontal: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  streakChip: {
    paddingHorizontal: Spacing.two,
    height: 32,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBtn: {
    paddingHorizontal: Spacing.three,
    height: 32,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    paddingHorizontal: Spacing.one,
    paddingBottom: Spacing.two,
  },
  chipToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
  },
  statusRow: {
    paddingHorizontal: Spacing.one,
    paddingBottom: Spacing.one,
  },
  weekdayRow: {
    flexDirection: 'row',
    paddingBottom: Spacing.one,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
  },
});
