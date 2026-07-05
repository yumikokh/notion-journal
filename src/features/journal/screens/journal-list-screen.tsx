import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
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
} from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { DayDrawer } from '@/features/journal/components/day-drawer';
import { FEELINGS, type Feeling } from '@/features/journal/draft';
import { coverImageSource } from '@/features/journal/cover-image';
import {
  buildMonthOptions,
  formatMonthHeader,
  selectJournalListEntries,
  shiftYearMonth,
} from '@/features/journal/journal-list';
import { useMonthEntries } from '@/features/journal/use-month-entries';
import { notionChipColor } from '@/features/notion/colors';
import { useTheme } from '@/hooks/use-theme';
import { isSupabaseEnvConfigured } from '@/lib/env';
import type { MonthEntry, NotionSelectColor } from '@/lib/supabase';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
/** How far back the month picker reaches (matches the calendar's range). */
const MAX_MONTHS_BACK = 24;

/**
 * Month-scoped journal list: one month at a time, switched with ‹ › arrows
 * or by tapping the title to open a month picker. A single month per view
 * keeps "5月の日記を読み返す" one tap away instead of scrolling a long
 * combined feed, and needs just one month query at a time.
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
  const monthOptions = useMemo(
    () => buildMonthOptions(currentYearMonth, MAX_MONTHS_BACK),
    [currentYearMonth],
  );

  const [yearMonth, setYearMonth] = useState(currentYearMonth);
  const [pickerOpen, setPickerOpen] = useState(false);

  const atNewest = yearMonth === monthOptions[0];
  const atOldest = yearMonth === monthOptions[monthOptions.length - 1];
  const goPrev = useCallback(() => {
    if (!atOldest) setYearMonth((m) => shiftYearMonth(m, -1));
  }, [atOldest]);
  const goNext = useCallback(() => {
    if (!atNewest) setYearMonth((m) => shiftYearMonth(m, 1));
  }, [atNewest]);

  const entries = useMonthEntries(yearMonth, { enabled: envOk });
  const listEntries = useMemo(
    () => selectJournalListEntries(entries.data ?? []),
    [entries.data],
  );

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

  const selectMonth = useCallback((month: string) => {
    setYearMonth(month);
    setPickerOpen(false);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: MonthEntry }) => (
      <JournalCard entry={item} scheme={scheme} onPress={() => openDay(item.date)} />
    ),
    [scheme, openDay],
  );

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
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
              {monthOptions.map((month) => {
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
    </ScreenContainer>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
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
  listContent: {
    gap: Spacing.three,
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
