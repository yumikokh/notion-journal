import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  useColorScheme,
} from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { DayDrawer } from '@/features/journal/components/day-drawer';
import { FEELINGS, type Feeling } from '@/features/journal/draft';
import {
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
/** Cap on how many months back we'll lazy-load (current month + this many). */
const MAX_MONTHS_BACK = 24;

type MonthState = {
  data: MonthEntry[] | undefined;
  isLoading: boolean;
};

type ListItem =
  | { key: string; type: 'header'; label: string }
  | { key: string; type: 'entry'; entry: MonthEntry };

export function JournalListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const envOk = isSupabaseEnvConfigured();

  const currentYearMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Newest-first list of loaded months. Starts with current + previous
  // month; onEndReached appends one older month at a time up to the cap.
  const [months, setMonths] = useState<string[]>(() => [
    currentYearMonth,
    shiftYearMonth(currentYearMonth, -1),
  ]);

  const [monthStates, setMonthStates] = useState<Record<string, MonthState>>({});

  const handleMonthUpdate = useCallback((month: string, state: MonthState) => {
    setMonthStates((prev) => {
      const existing = prev[month];
      if (existing && existing.isLoading === state.isLoading && existing.data === state.data) {
        return prev;
      }
      return { ...prev, [month]: state };
    });
  }, []);

  const loadMoreMonths = useCallback(() => {
    setMonths((prev) => {
      // `prev.length` equals the offset (in months) of the next candidate
      // — index 0 is the current month, index 1 is one month back, etc.
      if (prev.length > MAX_MONTHS_BACK) return prev;
      const last = prev[prev.length - 1];
      const next = shiftYearMonth(last, -1);
      return [...prev, next];
    });
  }, []);

  const [drawerDate, setDrawerDate] = useState<string | null>(null);
  const openDay = useCallback((dateKey: string) => setDrawerDate(dateKey), []);
  const closeDrawer = useCallback(() => setDrawerDate(null), []);

  const listItems = useMemo(() => {
    const items: ListItem[] = [];
    for (const month of months) {
      const selected = selectJournalListEntries(monthStates[month]?.data ?? []);
      if (selected.length === 0) continue;
      items.push({ key: `header-${month}`, type: 'header', label: formatMonthHeader(month) });
      for (const entry of selected) {
        items.push({ key: entry.pageId, type: 'entry', entry });
      }
    }
    return items;
  }, [months, monthStates]);

  // Aggregate feeling → Notion color across every loaded month so the
  // DayDrawer's FeelingPicker can tint options with the user's real palette.
  const feelingColorMap = useMemo(() => {
    const map: Partial<Record<Feeling, NotionSelectColor | null>> = {};
    for (const month of months) {
      monthStates[month]?.data?.forEach((entry) => {
        if (!entry.feeling || !FEELINGS.includes(entry.feeling as Feeling)) return;
        const key = entry.feeling as Feeling;
        if (!(key in map)) map[key] = entry.feelingColor;
      });
    }
    return map;
  }, [months, monthStates]);

  const isFetchingAny = envOk && months.some((month) => monthStates[month]?.isLoading !== false);

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === 'header') {
        return (
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeader}>
            {item.label}
          </ThemedText>
        );
      }
      return (
        <JournalCard entry={item.entry} scheme={scheme} onPress={() => openDay(item.entry.date)} />
      );
    },
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
        <ThemedText type="subtitle" style={styles.headerTitle} numberOfLines={1}>
          日記の一覧
        </ThemedText>
        <View style={styles.headerSide} />
      </View>

      <FlatList
        data={listItems}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        onEndReached={loadMoreMonths}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={
          isFetchingAny ? (
            <ActivityIndicator
              size="small"
              color={theme.textSecondary}
              style={styles.footerSpinner}
            />
          ) : null
        }
        ListEmptyComponent={
          isFetchingAny ? null : !envOk ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
              Notion 未接続
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
              まだ日記がありません。今日のひとことから始めてみませんか？
            </ThemedText>
          )
        }
      />

      {months.map((month) => (
        <MonthDataLoader
          key={month}
          month={month}
          enabled={envOk}
          onUpdate={handleMonthUpdate}
        />
      ))}

      <DayDrawer date={drawerDate} onClose={closeDrawer} feelingColors={feelingColorMap} />
    </ScreenContainer>
  );
}

/**
 * Headless data loader — fetches one month's entries via the shared
 * `useMonthEntries` query and reports the result up to the parent. Kept as
 * its own component (rather than calling the hook in a loop) so React's
 * rules-of-hooks are respected while the number of loaded months grows.
 */
function MonthDataLoader({
  month,
  enabled,
  onUpdate,
}: {
  month: string;
  enabled: boolean;
  onUpdate: (month: string, state: MonthState) => void;
}) {
  const query = useMonthEntries(month, { enabled });

  useEffect(() => {
    onUpdate(month, { data: query.data, isLoading: query.isLoading });
  }, [month, query.data, query.isLoading, onUpdate]);

  return null;
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
          source={{ uri: entry.coverUrl }}
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  listContent: {
    gap: Spacing.three,
    paddingBottom: Spacing.five,
  },
  sectionHeader: {
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },
  footerSpinner: {
    paddingVertical: Spacing.three,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.five,
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
