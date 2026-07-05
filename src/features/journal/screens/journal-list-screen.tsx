import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useColorScheme,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { coverImageSource } from '@/features/journal/cover-image';
import { DayDrawer } from '@/features/journal/components/day-drawer';
import { FEELINGS, type Feeling } from '@/features/journal/draft';
import {
  buildMonthOptions,
  formatMonthHeader,
  selectJournalListEntries,
} from '@/features/journal/journal-list';
import { useMonthEntries } from '@/features/journal/use-month-entries';
import { notionChipColor } from '@/features/notion/colors';
import { useTheme } from '@/hooks/use-theme';
import { isSupabaseEnvConfigured } from '@/lib/env';
import type { MonthEntry, NotionSelectColor } from '@/lib/supabase';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
/** How far back the pager/month picker reaches (matches the calendar). */
const MAX_MONTHS_BACK = 24;

/**
 * Journal list, one month per page — swiped horizontally like flipping
 * through a book. The header offers ‹ › for single flips and a month picker
 * (tap the title) for long jumps. Pages are chronological (oldest on the
 * left) so swiping toward the right edge moves back in time, matching the
 * calendar's "up = past" direction.
 */
export function JournalListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const envOk = isSupabaseEnvConfigured();

  const currentYearMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  /** Oldest → newest so page order matches the timeline. */
  const months = useMemo(
    () => buildMonthOptions(currentYearMonth, MAX_MONTHS_BACK).reverse(),
    [currentYearMonth],
  );

  const [pageIndex, setPageIndex] = useState(months.length - 1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pageWidth, setPageWidth] = useState(0);
  const pagerRef = useRef<FlatList<string>>(null);
  const yearMonth = months[pageIndex];

  const atOldest = pageIndex === 0;
  const atNewest = pageIndex === months.length - 1;

  const goTo = useCallback(
    (index: number, animated: boolean) => {
      const clamped = Math.max(0, Math.min(months.length - 1, index));
      setPageIndex(clamped);
      pagerRef.current?.scrollToIndex({ index: clamped, animated });
    },
    [months.length],
  );
  const goPrev = useCallback(() => goTo(pageIndex - 1, true), [goTo, pageIndex]);
  const goNext = useCallback(() => goTo(pageIndex + 1, true), [goTo, pageIndex]);
  const selectMonth = useCallback(
    (month: string) => {
      setPickerOpen(false);
      const index = months.indexOf(month);
      if (index >= 0) goTo(index, false);
    },
    [months, goTo],
  );

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
        <Pressable
          // Deep links can land here with an empty stack — fall back to the
          // calendar tab instead of an unhandled GO_BACK.
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          accessibilityRole="button"
          accessibilityLabel="戻る"
          hitSlop={8}
          style={styles.headerSide}>
          <ChevronLeft size={24} color={theme.text} strokeWidth={2} />
        </Pressable>
        <View style={styles.monthNav}>
          <Pressable
            onPress={goPrev}
            disabled={atOldest}
            accessibilityRole="button"
            accessibilityLabel="前の月"
            hitSlop={8}
            style={[styles.monthNavBtn, { opacity: atOldest ? 0.3 : 1 }]}>
            <ChevronLeft size={18} color={theme.textSecondary} strokeWidth={2} />
          </Pressable>
          <Pressable
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="月を選択"
            style={styles.monthTitle}>
            <ThemedText type="subtitle">{formatMonthHeader(yearMonth)}</ThemedText>
            <ChevronDown size={16} color={theme.textSecondary} strokeWidth={2} />
          </Pressable>
          <Pressable
            onPress={goNext}
            disabled={atNewest}
            accessibilityRole="button"
            accessibilityLabel="次の月"
            hitSlop={8}
            style={[styles.monthNavBtn, { opacity: atNewest ? 0.3 : 1 }]}>
            <ChevronRight size={18} color={theme.textSecondary} strokeWidth={2} />
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

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}>
        <Pressable
          style={styles.pickerOverlay}
          accessibilityLabel="月の選択を閉じる"
          onPress={() => setPickerOpen(false)}>
          {/* Stop overlay-press from closing when tapping inside the sheet. */}
          <Pressable
            style={[styles.pickerSheet, { backgroundColor: theme.background }]}
            onPress={(e) => e.stopPropagation()}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.pickerTitle}>
              月を選択
            </ThemedText>
            <ScrollView style={styles.pickerScroll}>
              {[...months].reverse().map((month) => {
                const selected = month === yearMonth;
                return (
                  <Pressable
                    key={month}
                    onPress={() => selectMonth(month)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.pickerRow,
                      selected && { backgroundColor: theme.accentSoft },
                      pressed && { opacity: 0.6 },
                    ]}>
                    <ThemedText style={selected ? { color: theme.accent } : undefined}>
                      {formatMonthHeader(month)}
                    </ThemedText>
                    {selected && <Check size={16} color={theme.accent} strokeWidth={2.5} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

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

/** One swipeable page: a single month's entry cards in a vertical list. */
function MonthPage({ yearMonth, width, envOk, scheme, onDayPress }: MonthPageProps) {
  const theme = useTheme();
  const entries = useMonthEntries(yearMonth, { enabled: envOk });
  const listEntries = useMemo(
    () => selectJournalListEntries(entries.data ?? []),
    [entries.data],
  );

  const renderItem = useCallback(
    ({ item }: { item: MonthEntry }) => (
      <JournalCard entry={item} scheme={scheme} onPress={() => onDayPress(item.date)} />
    ),
    [scheme, onDayPress],
  );

  return (
    <View style={{ width }}>
      <FlatList
        data={listEntries}
        keyExtractor={(item) => item.pageId}
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
  monthNav: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  monthNavBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: Spacing.five,
  },
  pickerSheet: {
    borderRadius: Radius.xl,
    paddingVertical: Spacing.three,
    maxHeight: '60%',
  },
  pickerTitle: {
    textAlign: 'center',
    paddingBottom: Spacing.two,
  },
  pickerScroll: {
    paddingHorizontal: Spacing.two,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.md,
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
