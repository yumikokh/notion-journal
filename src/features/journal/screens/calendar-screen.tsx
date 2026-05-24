import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useColorScheme,
} from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { buildMonthGrid } from '@/features/journal/build-month-grid';
import {
  DEFAULT_PREFS,
  loadCalendarPrefs,
  saveCalendarPrefs,
  type CalendarPrefs,
} from '@/features/journal/calendar-prefs';
import { DayDrawer } from '@/features/journal/components/day-drawer';
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
import { getJapaneseHoliday } from '@/lib/holidays';
import type { MonthEntry, NotionSelectColor } from '@/lib/supabase';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
const CELL_DIARY_LINES = 4;
const HOLIDAY_COLOR = '#cc4444';
const CELL_ASPECT_RATIO = 0.78;

export function CalendarScreen() {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const envOk = isSupabaseEnvConfigured();
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);

  // Compute explicit cell width/height instead of relying on aspectRatio,
  // because iOS Yoga lets content (wrapped diary lines, cover images) push
  // cell heights past aspectRatio, leaving empty-row cells visibly shorter.
  // Measure the grid container directly via onLayout — using window width
  // would miss the ScreenContainer padding + iOS safe-area insets and let
  // the 7th column wrap.
  const [gridWidth, setGridWidth] = useState(0);
  const cellWidth = gridWidth > 0 ? gridWidth / 7 : 0;
  const cellHeight = cellWidth / CELL_ASPECT_RATIO;

  const [view, setView] = useState({
    year: today.getFullYear(),
    month: today.getMonth(), // 0-indexed
  });

  const [prefs, setPrefs] = useState<CalendarPrefs>(DEFAULT_PREFS);
  useEffect(() => {
    loadCalendarPrefs().then(setPrefs);
  }, []);

  // Filter panel visibility — hidden by default behind the action button.
  const [showFilters, setShowFilters] = useState(false);

  const [drawerDate, setDrawerDate] = useState<string | null>(null);

  const yearMonth = `${view.year}-${String(view.month + 1).padStart(2, '0')}`;
  const cells = useMemo(() => buildMonthGrid(view.year, view.month), [view]);

  const entries = useMonthEntries(yearMonth, { enabled: envOk });

  const entryByDate = useMemo(() => {
    const m = new Map<string, MonthEntry>();
    entries.data?.forEach((e) => m.set(e.date, e));
    return m;
  }, [entries.data]);

  const diaryList = useMemo(() => {
    const list = (entries.data ?? []).filter((e) => (e.diary ?? '').trim().length > 0);
    list.sort((a, b) => b.date.localeCompare(a.date));
    return list;
  }, [entries.data]);

  /**
   * Feeling → Notion select color, learned from any entries this month
   * that use the feeling. Lets the FeelingPicker tint unselected options
   * with the actual Notion color the user picked in their DB.
   */
  const feelingColorMap = useMemo(() => {
    const m: Partial<Record<Feeling, NotionSelectColor | null>> = {};
    entries.data?.forEach((e) => {
      if (!e.feeling || !FEELINGS.includes(e.feeling as Feeling)) return;
      const key = e.feeling as Feeling;
      if (!(key in m)) m[key] = e.feelingColor;
    });
    return m;
  }, [entries.data]);

  /**
   * Habit names discovered from this month's pages. Server returns the raw
   * Notion property names (e.g. "Output", "Book"); we preserve their order
   * by tracking first-seen position.
   */
  const habitNames = useMemo(() => {
    const seen: string[] = [];
    entries.data?.forEach((e) => {
      for (const name of Object.keys(e.habits ?? {})) {
        if (!seen.includes(name)) seen.push(name);
      }
    });
    return seen;
  }, [entries.data]);

  const prevMonth = () =>
    setView((p) => (p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 }));
  const nextMonth = () =>
    setView((p) => (p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 }));
  const goToday = () => setView({ year: today.getFullYear(), month: today.getMonth() });

  const openDay = useCallback((dateKey: string) => {
    setDrawerDate(dateKey);
  }, []);
  const closeDrawer = useCallback(() => setDrawerDate(null), []);

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

  const habitOverlayActive = prefs.habitOverlay.length > 0;

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <Pressable onPress={prevMonth} accessibilityLabel="前の月" style={styles.navBtn}>
              <ThemedText type="subtitle">‹</ThemedText>
            </Pressable>
          </View>
          <Pressable onPress={goToday} accessibilityLabel="今日">
            <ThemedText type="subtitle">
              {view.year}年{view.month + 1}月
            </ThemedText>
          </Pressable>
          <View style={[styles.headerSide, styles.headerSideRight]}>
            <Pressable onPress={nextMonth} accessibilityLabel="次の月" style={styles.navBtn}>
              <ThemedText type="subtitle">›</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setShowFilters((v) => !v)}
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
              <ThemedText style={styles.actionBtnIcon}>⋯</ThemedText>
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

        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((label, i) => (
            <ThemedText
              key={label}
              type="small"
              themeColor="textSecondary"
              style={[
                styles.weekdayLabel,
                i === 0 && { color: HOLIDAY_COLOR },
                i === 6 && { color: '#4477cc' },
              ]}>
              {label}
            </ThemedText>
          ))}
        </View>

        <View
          style={styles.grid}
          onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
          {cells.map((cell) => {
            const entry = entryByDate.get(cell.dateKey);
            const isToday = cell.dateKey === todayKey;
            const dayOfWeek = cell.date.getDay();
            const isHoliday = getJapaneseHoliday(cell.date) !== null;
            const cover = prefs.showCover && entry?.coverUrl ? entry.coverUrl : null;
            const diaryInCell =
              prefs.showDiary && entry?.diary ? entry.diary.trim() : '';

            const dateColor = cover
              ? '#ffffff'
              : isHoliday || dayOfWeek === 0
              ? HOLIDAY_COLOR
              : dayOfWeek === 6
              ? '#4477cc'
              : theme.text;

            return (
              <Pressable
                key={cell.dateKey}
                onPress={() => openDay(cell.dateKey)}
                accessibilityRole="button"
                accessibilityLabel={`${cell.date.getMonth() + 1}月${cell.date.getDate()}日`}
                style={({ pressed }) => [
                  styles.cell,
                  { width: cellWidth, height: cellHeight },
                  isToday && { backgroundColor: theme.backgroundSelected, borderRadius: 8 },
                  pressed && { opacity: 0.6 },
                ]}>
                {cover && (
                  <>
                    <Image source={{ uri: cover }} style={styles.coverImage} />
                    <View style={styles.coverDim} />
                  </>
                )}
                <ThemedText
                  type="small"
                  style={[
                    styles.dateNumber,
                    cover && styles.dateNumberOverCover,
                    {
                      opacity: cell.inMonth ? 1 : 0.25,
                      color: dateColor,
                    },
                  ]}>
                  {cell.date.getDate()}
                </ThemedText>
                <CellMark
                  entry={entry ?? null}
                  habitOverlay={prefs.habitOverlay}
                  habitOverlayActive={habitOverlayActive}
                  scheme={scheme}
                  overCover={Boolean(cover)}
                />
                {diaryInCell.length > 0 && (
                  <ThemedText
                    type="small"
                    numberOfLines={CELL_DIARY_LINES}
                    ellipsizeMode="tail"
                    style={[
                      styles.cellDiary,
                      cover ? styles.cellDiaryOverCover : { color: theme.textSecondary },
                    ]}>
                    {diaryInCell}
                  </ThemedText>
                )}
              </Pressable>
            );
          })}
        </View>

        {(!envOk || entries.isLoading || entries.error) && (
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
          </View>
        )}

        {diaryList.length > 0 && (
          <View style={styles.listSection}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.listHeader}>
              {view.month + 1}月の Diary
            </ThemedText>
            {diaryList.map((entry) => {
              const chip = entry.feeling
                ? notionChipColor(entry.feelingColor, scheme)
                : null;
              const [yyyy, mm, dd] = entry.date.split('-');
              const dateObj = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
              const weekday = WEEKDAY_LABELS[dateObj.getDay()];
              const diary = entry.diary ?? '';
              return (
                <Pressable
                  key={entry.pageId}
                  onPress={() => openDay(entry.date)}
                  accessibilityRole="button"
                  accessibilityLabel={`${Number(mm)}月${Number(dd)}日 のジャーナルを開く`}
                  style={({ pressed }) => [
                    styles.listItem,
                    { borderBottomColor: theme.backgroundElement },
                    pressed && { opacity: 0.6 },
                  ]}>
                  <View style={styles.listDateColumn}>
                    <ThemedText type="smallBold">
                      {Number(mm)}/{Number(dd)} ({weekday})
                    </ThemedText>
                    {chip && entry.feeling ? (
                      <View
                        style={[styles.listChip, { backgroundColor: chip.background }]}>
                        <ThemedText
                          style={[styles.chipText, { color: chip.text }]}
                          numberOfLines={1}>
                          {entry.feeling}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                  <ThemedText type="small" style={styles.listDiary}>
                    {diary}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
      <DayDrawer
        date={drawerDate}
        onClose={closeDrawer}
        feelingColors={feelingColorMap}
      />
    </ScreenContainer>
  );
}

type CellMarkProps = {
  entry: MonthEntry | null;
  habitOverlay: string[];
  habitOverlayActive: boolean;
  scheme: 'light' | 'dark';
  overCover: boolean;
};

function CellMark({ entry, habitOverlay, habitOverlayActive, scheme, overCover }: CellMarkProps) {
  if (habitOverlayActive) {
    const activeHabits = entry
      ? habitOverlay.filter((k) => entry.habits?.[k])
      : [];
    if (activeHabits.length === 0) {
      return null;
    }
    const iconColor = overCover ? '#ffffff' : scheme === 'dark' ? '#dddddd' : '#333333';
    return (
      <View style={styles.habitIconRow}>
        {activeHabits.map((k) => {
          const Icon = habitIcon(k);
          return <Icon key={k} size={12} color={iconColor} strokeWidth={2} />;
        })}
      </View>
    );
  }

  if (entry?.icon?.type === 'emoji') {
    return (
      <ThemedText style={styles.icon} numberOfLines={1}>
        {entry.icon.emoji}
      </ThemedText>
    );
  }
  if (entry?.icon?.type === 'external') {
    return <Image source={{ uri: entry.icon.url }} style={styles.iconImage} />;
  }
  if (entry?.feeling && !overCover) {
    const chip = notionChipColor(entry.feelingColor, scheme);
    return (
      <View style={[styles.chip, { backgroundColor: chip.background }]}>
        <ThemedText
          style={[styles.chipText, { color: chip.text }]}
          numberOfLines={1}>
          {entry.feeling}
        </ThemedText>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingVertical: Spacing.four,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    gap: Spacing.two,
  },
  headerSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSideRight: {
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  navBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnIcon: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  habitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  chipToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
  },
  chipToggleIcon: {
    fontSize: 14,
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
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: Spacing.one,
    gap: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  coverImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    resizeMode: 'cover',
  },
  coverDim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  dateNumber: {
    zIndex: 1,
  },
  dateNumberOverCover: {
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 2,
    fontWeight: '700',
  },
  icon: {
    fontSize: 16,
    lineHeight: 18,
  },
  iconImage: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },
  habitIconRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    maxWidth: '100%',
    zIndex: 1,
  },
  habitIcon: {
    fontSize: 11,
    lineHeight: 14,
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
  cellDiary: {
    fontSize: 9,
    lineHeight: 11,
    paddingHorizontal: 3,
    textAlign: 'left',
    alignSelf: 'stretch',
    zIndex: 1,
  },
  cellDiaryOverCover: {
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowRadius: 2,
  },
  statusRow: {
    paddingHorizontal: Spacing.two,
  },
  statusInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  listSection: {
    paddingHorizontal: Spacing.two,
    gap: Spacing.two,
  },
  listHeader: {
    marginTop: 0,
  },
  listItem: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listDateColumn: {
    width: 64,
    alignItems: 'flex-start',
    gap: 2,
  },
  listChip: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  listDiary: {
    flex: 1,
    flexShrink: 1,
    flexBasis: 0,
  },
});
