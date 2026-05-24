import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, useColorScheme } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { buildMonthGrid } from '@/features/journal/build-month-grid';
import { useMonthEntries } from '@/features/journal/use-month-entries';
import { notionChipColor } from '@/features/notion/colors';
import { useTheme } from '@/hooks/use-theme';
import { toDateKey } from '@/lib/date';
import { isSupabaseEnvConfigured } from '@/lib/env';
import type { MonthEntry } from '@/lib/supabase';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export function CalendarScreen() {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const envOk = isSupabaseEnvConfigured();
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);

  const [view, setView] = useState({
    year: today.getFullYear(),
    month: today.getMonth(), // 0-indexed
  });

  const yearMonth = `${view.year}-${String(view.month + 1).padStart(2, '0')}`;
  const cells = useMemo(() => buildMonthGrid(view.year, view.month), [view]);

  const entries = useMonthEntries(yearMonth, { enabled: envOk });

  // date → entry lookup. Built once per data fetch.
  const entryByDate = useMemo(() => {
    const m = new Map<string, MonthEntry>();
    entries.data?.forEach((e) => m.set(e.date, e));
    return m;
  }, [entries.data]);

  const prevMonth = () =>
    setView((p) => (p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 }));
  const nextMonth = () =>
    setView((p) => (p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 }));
  const goToday = () => setView({ year: today.getFullYear(), month: today.getMonth() });

  const openDay = useCallback((dateKey: string) => {
    router.push({ pathname: '/day/[date]', params: { date: dateKey } });
  }, []);

  return (
    <ScreenContainer>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={prevMonth} accessibilityLabel="前の月" style={styles.navBtn}>
            <ThemedText type="subtitle">‹</ThemedText>
          </Pressable>
          <Pressable onPress={goToday} accessibilityLabel="今日">
            <ThemedText type="subtitle">
              {view.year}年{view.month + 1}月
            </ThemedText>
          </Pressable>
          <Pressable onPress={nextMonth} accessibilityLabel="次の月" style={styles.navBtn}>
            <ThemedText type="subtitle">›</ThemedText>
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((label, i) => (
            <ThemedText
              key={label}
              type="small"
              themeColor="textSecondary"
              style={[
                styles.weekdayLabel,
                i === 0 && { color: '#cc4444' },
                i === 6 && { color: '#4477cc' },
              ]}>
              {label}
            </ThemedText>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((cell) => {
            const entry = entryByDate.get(cell.dateKey);
            const isToday = cell.dateKey === todayKey;
            const dayOfWeek = cell.date.getDay();
            const chip = entry?.feeling
              ? notionChipColor(entry.feelingColor, scheme)
              : null;

            return (
              <Pressable
                key={cell.dateKey}
                onPress={() => openDay(cell.dateKey)}
                accessibilityRole="button"
                accessibilityLabel={`${cell.date.getMonth() + 1}月${cell.date.getDate()}日`}
                style={({ pressed }) => [
                  styles.cell,
                  isToday && { backgroundColor: theme.backgroundSelected, borderRadius: 8 },
                  pressed && { opacity: 0.6 },
                ]}>
                <ThemedText
                  type="small"
                  style={{
                    opacity: cell.inMonth ? 1 : 0.25,
                    color:
                      dayOfWeek === 0
                        ? '#cc4444'
                        : dayOfWeek === 6
                        ? '#4477cc'
                        : theme.text,
                  }}>
                  {cell.date.getDate()}
                </ThemedText>
                {entry?.icon?.type === 'emoji' ? (
                  <ThemedText style={styles.icon} numberOfLines={1}>
                    {entry.icon.emoji}
                  </ThemedText>
                ) : chip && entry?.feeling ? (
                  <View style={[styles.chip, { backgroundColor: chip.background }]}>
                    <ThemedText
                      style={[styles.chipText, { color: chip.text }]}
                      numberOfLines={1}>
                      {entry.feeling}
                    </ThemedText>
                  </View>
                ) : (
                  <View style={styles.feelingPlaceholder} />
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.statusRow}>
          {!envOk && (
            <ThemedText type="small" themeColor="textSecondary">
              Notion 未接続
            </ThemedText>
          )}
          {entries.isLoading && (
            <View style={styles.statusInline}>
              <ActivityIndicator size="small" color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                {yearMonth} を読み込み中…
              </ThemedText>
            </View>
          )}
          {entries.error && (
            <ThemedText type="small" style={{ color: '#cc4444' }}>
              読み込み失敗: {entries.error.message}
            </ThemedText>
          )}
          {entries.data && !entries.isLoading && (
            <ThemedText type="small" themeColor="textSecondary">
              {entries.data.length} 件の記録
            </ThemedText>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
  },
  navBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 0.9,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: Spacing.one,
    gap: 2,
    overflow: 'hidden',
  },
  icon: {
    fontSize: 16,
    lineHeight: 18,
  },
  chip: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    maxWidth: '96%',
  },
  chipText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
  },
  feelingPlaceholder: {
    height: 16,
  },
  statusRow: {
    paddingHorizontal: Spacing.two,
  },
  statusInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
