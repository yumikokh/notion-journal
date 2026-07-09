import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronLeft, Plus } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  useColorScheme,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WheelPicker } from '@/components/wheel-picker';
import { WheelSheet } from '@/components/wheel-sheet';
import { Radius, Spacing } from '@/constants/theme';
import { coverImageSource } from '@/features/journal/cover-image';
import { DayDrawer } from '@/features/journal/components/day-drawer';
import { FEELINGS, type Feeling } from '@/features/journal/draft';
import {
  buildMonthDayItems,
  buildMonthOptions,
  formatMonthHeader,
  monthsSince,
  type JournalDayItem,
} from '@/features/journal/journal-list';
import { useJournalRange } from '@/features/journal/use-journal-range';
import { useMonthEntries } from '@/features/journal/use-month-entries';
import { notionChipColor } from '@/features/notion/colors';
import { useTheme } from '@/hooks/use-theme';
import { toDateKey } from '@/lib/date';
import { isSupabaseEnvConfigured } from '@/lib/env';
import type { MonthEntry, NotionSelectColor } from '@/lib/supabase';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
/** Liquid glass needs iOS 26+; older systems get solid-color fallbacks. */
const glassOk = isLiquidGlassAvailable();
/** How far back the pager/month picker reaches (matches the calendar). */
const MAX_MONTHS_BACK = 24;

/**
 * Journal list, one month per page — swiped horizontally like flipping
 * through a book. Pages are chronological (oldest on the left) so swiping
 * toward the right edge moves back in time, matching the calendar's
 * "up = past" direction. The range runs from the first journal entry to
 * the current month, so the picker's bound is the data itself.
 */
export function JournalListScreen() {
  const theme = useTheme();
  const envOk = isSupabaseEnvConfigured();

  const currentYearMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Resolve the range before mounting the pager — its page indices must not
  // shift underneath the FlatList once rendered.
  const journalRange = useJournalRange({ enabled: envOk });
  /** Oldest → newest so page order matches the timeline. */
  const months = useMemo(() => {
    const back = journalRange.data
      ? monthsSince(journalRange.data, currentYearMonth)
      : MAX_MONTHS_BACK;
    return buildMonthOptions(currentYearMonth, back).reverse();
  }, [journalRange.data, currentYearMonth]);

  if (journalRange.isLoading) {
    return (
      <ThemedView style={styles.root}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.rangeLoading}>
            <ActivityIndicator color={theme.textSecondary} />
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // Keyed by the range start so a late change (e.g. backfilled history)
  // remounts the pager instead of shifting indices under it.
  return <JournalListPager key={months[0]} months={months} />;
}

/** The swipeable pager over a fixed, already-resolved list of months. */
function JournalListPager({ months }: { months: string[] }) {
  const theme = useTheme();
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const envOk = isSupabaseEnvConfigured();

  const [pageIndex, setPageIndex] = useState(months.length - 1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pageWidth, setPageWidth] = useState(0);
  const pagerRef = useRef<FlatList<string>>(null);
  const yearMonth = months[pageIndex];


  const goTo = useCallback(
    (index: number, animated: boolean) => {
      const clamped = Math.max(0, Math.min(months.length - 1, index));
      setPageIndex(clamped);
      pagerRef.current?.scrollToIndex({ index: clamped, animated });
    },
    [months.length],
  );

  // 年 / 月 columns for the picker sheet; committed only via この月へ.
  const pickerYears = useMemo(
    () => [...new Set(months.map((m) => Number(m.slice(0, 4))))],
    [months],
  );
  const monthsOf = useCallback(
    (year: number) =>
      months
        .filter((m) => Number(m.slice(0, 4)) === year)
        .map((m) => Number(m.slice(5, 7))),
    [months],
  );
  const [selYear, setSelYear] = useState(() => Number(yearMonth.slice(0, 4)));
  const [selMonth, setSelMonth] = useState(() => Number(yearMonth.slice(5, 7)));
  const openPicker = () => {
    setSelYear(Number(yearMonth.slice(0, 4)));
    setSelMonth(Number(yearMonth.slice(5, 7)));
    setPickerOpen(true);
  };
  const handleYear = (year: number) => {
    const options = monthsOf(year);
    setSelYear(year);
    if (!options.includes(selMonth)) {
      // Snap to the nearest month available in the newly picked year.
      setSelMonth(
        options.reduce((best, m) =>
          Math.abs(m - selMonth) < Math.abs(best - selMonth) ? m : best,
        ),
      );
    }
  };
  const confirmMonth = () => {
    const key = `${selYear}-${String(selMonth).padStart(2, '0')}`;
    const i = months.indexOf(key);
    if (i >= 0) goTo(i, false);
  };

  // Keep the header in sync when the user swipes instead of using buttons.
  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (pageWidth <= 0) return;
      const index = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
      setPageIndex(Math.max(0, Math.min(months.length - 1, index)));
    },
    [pageWidth, months.length],
  );

  // The visible month's entries back the DayDrawer's feeling → color map.
  // The page component queries the same key, so this costs no extra fetch.
  const entries = useMonthEntries(yearMonth, { enabled: envOk });
  const feelingColorMap = useMemo(() => {
    const map: Partial<Record<Feeling, NotionSelectColor | null>> = {};
    entries.data?.forEach((entry) => {
      if (!entry.feeling || !FEELINGS.includes(entry.feeling as Feeling)) return;
      const key = entry.feeling as Feeling;
      if (!(key in map)) map[key] = entry.feelingColor;
    });
    return map;
  }, [entries.data]);

  const [drawerDate, setDrawerDate] = useState<string | null>(null);
  const openDay = useCallback((dateKey: string) => setDrawerDate(dateKey), []);
  const closeDrawer = useCallback(() => setDrawerDate(null), []);

  const renderPage = useCallback(
    ({ item }: { item: string }) => (
      <MonthPage
        yearMonth={item}
        width={pageWidth}
        envOk={envOk}
        scheme={scheme}
        onDayPress={openDay}
      />
    ),
    [pageWidth, envOk, scheme, openDay],
  );

  return (
    // Custom shell without horizontal padding: the pager must span the full
    // screen width so pages flip edge-to-edge; each page carries its own
    // inner padding instead.
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
        <GlassView
          glassEffectStyle="regular"
          isInteractive
          style={[styles.backGlass, !glassOk && { backgroundColor: theme.backgroundElement }]}>
          <Pressable
            // Deep links can land here with an empty stack — fall back to the
            // calendar tab instead of an unhandled GO_BACK.
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            accessibilityRole="button"
            accessibilityLabel="戻る"
            hitSlop={8}
            style={styles.backGlassInner}>
            <ChevronLeft size={20} color={theme.text} strokeWidth={2} />
          </Pressable>
        </GlassView>
        {/* Single-month flips are covered by swiping the pager itself, so
            the header keeps just the picker entry — no ‹ › clutter. */}
        <View style={styles.monthNav}>
          <Pressable
            onPress={openPicker}
            accessibilityRole="button"
            accessibilityLabel="月を選択"
            style={styles.monthTitle}>
            <ThemedText type="subtitle">{formatMonthHeader(yearMonth)}</ThemedText>
            <ChevronDown size={16} color={theme.textSecondary} strokeWidth={2} />
          </Pressable>
        </View>
        <View style={styles.headerSide} />
      </View>

      <View
        style={styles.pagerContainer}
        onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}>
        {pageWidth > 0 && (
          <FlatList
            ref={pagerRef}
            horizontal
            pagingEnabled
            data={months}
            keyExtractor={(m) => m}
            renderItem={renderPage}
            getItemLayout={(_, index) => ({
              length: pageWidth,
              offset: pageWidth * index,
              index,
            })}
            initialScrollIndex={months.length - 1}
            onMomentumScrollEnd={onMomentumScrollEnd}
            showsHorizontalScrollIndicator={false}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            windowSize={3}
          />
        )}
      </View>

      <WheelSheet
        visible={pickerOpen}
        title="月を選択"
        confirmLabel="この月へ"
        onConfirm={confirmMonth}
        onClose={() => setPickerOpen(false)}>
        <View style={styles.pickerColumns}>
          <View style={styles.pickerColumn}>
            <WheelPicker
              align="right"
              items={pickerYears.map((y) => ({ key: String(y), label: `${y}年` }))}
              initialIndex={Math.max(0, pickerYears.indexOf(selYear))}
              onChange={(i) => handleYear(pickerYears[i])}
            />
          </View>
          <View style={styles.pickerColumn}>
            <WheelPicker
              key={`m-${selYear}`}
              align="left"
              items={monthsOf(selYear).map((m) => ({ key: String(m), label: `${m}月` }))}
              initialIndex={Math.max(0, monthsOf(selYear).indexOf(selMonth))}
              onChange={(i) => setSelMonth(monthsOf(selYear)[i])}
            />
          </View>
        </View>
      </WheelSheet>

        <DayDrawer date={drawerDate} onClose={closeDrawer} feelingColors={feelingColorMap} />
      </SafeAreaView>
    </ThemedView>
  );
}

type MonthPageProps = {
  yearMonth: string;
  width: number;
  envOk: boolean;
  scheme: 'light' | 'dark';
  onDayPress: (dateKey: string) => void;
};

/**
 * One swipeable page: every day of the month in a vertical list — full
 * cards for days with journal content, slim tappable rows for days not
 * written yet (so past days can be filled in from here).
 */
function MonthPage({ yearMonth, width, envOk, scheme, onDayPress }: MonthPageProps) {
  const theme = useTheme();
  const entries = useMonthEntries(yearMonth, { enabled: envOk });
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  // Keep the list empty until data arrives so the loading spinner shows
  // instead of a flash of all-unwritten rows.
  const dayItems = useMemo(
    () =>
      !envOk || entries.isLoading
        ? []
        : buildMonthDayItems(yearMonth, entries.data ?? [], todayKey),
    [envOk, entries.isLoading, yearMonth, entries.data, todayKey],
  );

  const renderItem = useCallback(
    ({ item }: { item: JournalDayItem }) =>
      item.hasContent && item.entry ? (
        <JournalCard
          entry={item.entry}
          scheme={scheme}
          onPress={() => onDayPress(item.dateKey)}
        />
      ) : (
        <EmptyDayRow item={item} scheme={scheme} onPress={() => onDayPress(item.dateKey)} />
      ),
    [scheme, onDayPress],
  );

  return (
    <View style={{ width }}>
      <FlatList
        data={dayItems}
        keyExtractor={(item) => item.dateKey}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          envOk ? (
            <RefreshControl
              refreshing={entries.isRefetching}
              onRefresh={() => {
                entries.refetch();
              }}
              tintColor={theme.textSecondary}
            />
          ) : undefined
        }
        ListEmptyComponent={
          entries.isLoading && envOk ? (
            <ActivityIndicator
              size="small"
              color={theme.textSecondary}
              style={styles.emptySpinner}
            />
          ) : !envOk ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
              Notion 未接続
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
              この月の日記はまだありません。
            </ThemedText>
          )
        }
      />
    </View>
  );
}

const formatDayLabel = (dateKey: string) => {
  const [yyyy, mm, dd] = dateKey.split('-');
  const dateObj = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return `${Number(mm)}/${Number(dd)} (${WEEKDAY_LABELS[dateObj.getDay()]})`;
};

type EmptyDayRowProps = {
  item: JournalDayItem;
  scheme: 'light' | 'dark';
  onPress: () => void;
};

/**
 * A day without journal content: a quiet row inviting the user to fill it
 * in. A feeling recorded that day (habit-only entries) still shows.
 */
function EmptyDayRow({ item, scheme, onPress }: EmptyDayRowProps) {
  const theme = useTheme();
  const entry = item.entry;
  const chip = entry?.feeling ? notionChipColor(entry.feelingColor, scheme) : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${formatDayLabel(item.dateKey)} の日記を書く`}
      style={({ pressed }) => [
        styles.emptyDayRow,
        { borderBottomColor: theme.backgroundElement },
        pressed && { opacity: 0.6 },
      ]}>
      <ThemedText type="small" themeColor="textSecondary">
        {formatDayLabel(item.dateKey)}
      </ThemedText>
      {chip && entry?.feeling ? (
        <View style={[styles.chip, { backgroundColor: chip.background }]}>
          <ThemedText style={[styles.chipText, { color: chip.text }]} numberOfLines={1}>
            {entry.feeling}
          </ThemedText>
        </View>
      ) : null}
      <View style={styles.emptyDaySpacer} />
      <Plus size={14} color={theme.textSecondary} strokeWidth={1.8} />
    </Pressable>
  );
}

type JournalCardProps = {
  entry: MonthEntry;
  scheme: 'light' | 'dark';
  onPress: () => void;
};

function JournalCard({ entry, scheme, onPress }: JournalCardProps) {
  const theme = useTheme();
  const chip = entry.feeling ? notionChipColor(entry.feelingColor, scheme) : null;
  const [yyyy, mm, dd] = entry.date.split('-');
  const dateObj = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  const weekday = WEEKDAY_LABELS[dateObj.getDay()];
  const diary = (entry.diary ?? '').trim();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${Number(mm)}月${Number(dd)}日 のジャーナルを開く`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.cardPressed,
      ]}>
      {entry.coverUrl && (
        <Image
          source={coverImageSource(entry.coverUrl)}
          style={styles.cardCover}
          contentFit="cover"
          transition={150}
        />
      )}
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <ThemedText type="smallBold">
            {Number(mm)}/{Number(dd)} ({weekday})
          </ThemedText>
          {chip && entry.feeling ? (
            <View style={[styles.chip, { backgroundColor: chip.background }]}>
              <ThemedText style={[styles.chipText, { color: chip.text }]} numberOfLines={1}>
                {entry.feeling}
              </ThemedText>
            </View>
          ) : null}
        </View>
        {diary.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={4}>
            {diary}
          </ThemedText>
        )}
      </View>
    </Pressable>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  headerSide: {
    width: 32,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backGlass: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  backGlassInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNav: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  monthTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  pagerContainer: {
    flex: 1,
  },
  listContent: {
    gap: Spacing.three,
    // Page-local padding — the pager itself spans the full screen width.
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
  },
  emptySpinner: {
    paddingVertical: Spacing.five,
  },
  emptyDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  emptyDaySpacer: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
  rangeLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerColumns: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.five,
  },
  pickerColumn: {
    flex: 1,
  },
  card: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardCover: {
    width: '100%',
    height: 180,
  },
  cardBody: {
    padding: Spacing.three,
    gap: Spacing.one,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    maxWidth: '70%',
  },
  chipText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
  },
});
