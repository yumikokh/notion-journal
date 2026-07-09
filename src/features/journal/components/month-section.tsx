import { Image } from 'expo-image';
import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { MonthCell } from '@/features/journal/build-month-grid';
import type { CalendarViewMode } from '@/features/journal/calendar-prefs';
import { coverImageSource } from '@/features/journal/cover-image';
import { habitIcon } from '@/features/journal/habit-icons';
import { useMonthEntries } from '@/features/journal/use-month-entries';
import { notionChipColor } from '@/features/notion/colors';
import { useTheme } from '@/hooks/use-theme';
import { getJapaneseHoliday } from '@/lib/holidays';
import type { MonthEntry } from '@/lib/supabase';

/**
 * Fixed vertical metrics for one month section. The screen's FlatList
 * computes `getItemLayout` from these + the measured cell height, so any
 * change here must keep `monthSectionHeight` in sync with what actually
 * renders (heights are set explicitly below — nothing may grow content).
 */
export const MONTH_HEADER_HEIGHT = 44;
export const MONTH_BOTTOM_GAP = 12;
const CELL_DIARY_LINES = 3;

export function monthSectionHeight(weeksCount: number, cellHeight: number): number {
  return MONTH_HEADER_HEIGHT + weeksCount * cellHeight + MONTH_BOTTOM_GAP;
}

type MonthSectionProps = {
  year: number;
  /** 0-indexed month to match the JavaScript Date constructor. */
  month: number;
  weeks: MonthCell[][];
  cellWidth: number;
  cellHeight: number;
  mode: CalendarViewMode;
  todayKey: string;
  scheme: 'light' | 'dark';
  /** False when Supabase env is missing — skips fetching entirely. */
  enabled: boolean;
  onDayPress: (dateKey: string) => void;
};

/**
 * One month inside the continuous vertical calendar: a small month label
 * followed by the month's week rows. Fetches its own entries so months
 * load lazily as they scroll into the FlatList render window.
 */
export const MonthSection = memo(function MonthSection({
  year,
  month,
  weeks,
  cellWidth,
  cellHeight,
  mode,
  todayKey,
  scheme,
  enabled,
  onDayPress,
}: MonthSectionProps) {
  const theme = useTheme();
  const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;
  const entries = useMonthEntries(yearMonth, { enabled });

  const entryByDate = new Map<string, MonthEntry>();
  entries.data?.forEach((e) => entryByDate.set(e.date, e));

  return (
    <View style={{ height: monthSectionHeight(weeks.length, cellHeight) }}>
      <View style={styles.monthHeader}>
        {/* Quieter than the screen's fixed header (which tracks the visible
            month) so the two don't read as a duplicated title. */}
        <ThemedText type="smallBold" themeColor="textSecondary">
          {year}年{month + 1}月
        </ThemedText>
        {enabled && entries.isLoading && (
          <ActivityIndicator size="small" color={theme.textSecondary} />
        )}
        {enabled && entries.error && (
          <Pressable onPress={() => entries.refetch()} accessibilityLabel="再読み込み">
            <ThemedText type="small" style={{ color: theme.danger }}>
              読み込めませんでした（タップで再試行）
            </ThemedText>
          </Pressable>
        )}
      </View>
      {weeks.map((week) => (
        <View key={week[0].dateKey} style={styles.weekRow}>
          {week.map((cell) =>
            cell.inMonth ? (
              <DayCell
                key={cell.dateKey}
                cell={cell}
                entry={entryByDate.get(cell.dateKey) ?? null}
                isToday={cell.dateKey === todayKey}
                cellWidth={cellWidth}
                cellHeight={cellHeight}
                mode={mode}
                scheme={scheme}
                onPress={onDayPress}
              />
            ) : (
              // Adjacent-month day: rendered blank — the neighboring month
              // section owns it, so repeating it here would read as a duplicate.
              <View key={cell.dateKey} style={{ width: cellWidth, height: cellHeight }} />
            ),
          )}
        </View>
      ))}
    </View>
  );
});

type DayCellProps = {
  cell: MonthCell;
  entry: MonthEntry | null;
  isToday: boolean;
  cellWidth: number;
  cellHeight: number;
  mode: CalendarViewMode;
  scheme: 'light' | 'dark';
  onPress: (dateKey: string) => void;
};

function DayCell({
  cell,
  entry,
  isToday,
  cellWidth,
  cellHeight,
  mode,
  scheme,
  onPress,
}: DayCellProps) {
  const theme = useTheme();
  const dayOfWeek = cell.date.getDay();
  const isHoliday = getJapaneseHoliday(cell.date) !== null;
  const cover = mode.showCover && entry?.coverUrl ? entry.coverUrl : null;
  const diaryInCell = mode.showDiary && entry?.diary ? entry.diary.trim() : '';
  const feelingChip =
    mode.showMark && entry?.feeling ? notionChipColor(entry.feelingColor, scheme) : null;

  const dateColor = cover
    ? '#ffffff'
    : isHoliday || dayOfWeek === 0
      ? theme.holiday
      : dayOfWeek === 6
        ? theme.saturday
        : theme.text;

  return (
    <Pressable
      onPress={() => onPress(cell.dateKey)}
      accessibilityRole="button"
      accessibilityLabel={`${cell.date.getMonth() + 1}月${cell.date.getDate()}日`}
      style={({ pressed }) => [
        { width: cellWidth, height: cellHeight, padding: 1.5 },
        pressed && { opacity: 0.6 },
      ]}>
      <View style={styles.cellInner}>
        {cover && (
          <>
            <Image
              source={coverImageSource(cover)}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={120}
              recyclingKey={cell.dateKey}
            />
            <View style={styles.coverDim} />
          </>
        )}
        <View style={styles.dateRow} accessibilityElementsHidden>
          <View style={[styles.dateBadge, isToday && { backgroundColor: theme.accent }]}>
            <ThemedText
              type="small"
              style={[
                styles.dateNumber,
                { color: isToday ? '#ffffff' : dateColor },
                cover && !isToday && styles.dateNumberOverCover,
              ]}>
              {cell.date.getDate()}
            </ThemedText>
          </View>
          {/* Feeling: a small dot beside the date, vertically centered.
              The saturated (text) end of the Notion palette — the pale tag
              tint disappears at dot size. */}
          {feelingChip && (
            <View style={[styles.feelingDot, { backgroundColor: feelingChip.text }]} />
          )}
        </View>
        <CellMark entry={entry} mode={mode} scheme={scheme} overCover={Boolean(cover)} />
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
      </View>
    </Pressable>
  );
}

type CellMarkProps = {
  entry: MonthEntry | null;
  mode: CalendarViewMode;
  scheme: 'light' | 'dark';
  overCover: boolean;
};

function CellMark({ entry, mode, scheme, overCover }: CellMarkProps) {
  const habitsActive = mode.habits === 'all' || mode.habits.length > 0;
  if (habitsActive) {
    const checked = entry
      ? Object.keys(entry.habits ?? {}).filter((k) => entry.habits?.[k])
      : [];
    const activeHabits =
      mode.habits === 'all' ? checked : checked.filter((k) => mode.habits.includes(k));
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

  if (!mode.showMark) {
    return null;
  }

  if (entry?.icon?.type === 'emoji') {
    return (
      <ThemedText style={styles.icon} numberOfLines={1}>
        {entry.icon.emoji}
      </ThemedText>
    );
  }
  if (entry?.icon?.type === 'external') {
    return <Image source={entry.icon.url} style={styles.iconImage} />;
  }
  // Feeling is expressed as the date badge's ground color (see DayCell),
  // not as a mark of its own.
  return null;
}

const styles = StyleSheet.create({
  monthHeader: {
    height: MONTH_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
    paddingBottom: Spacing.one,
  },
  weekRow: {
    flexDirection: 'row',
  },
  cellInner: {
    flex: 1,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    paddingTop: Spacing.one,
    gap: 2,
  },
  coverDim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.14)',
  },
  dateRow: {
    // Top-left corner (Notion/Google-calendar style); the rest of the
    // cell's content stays centered.
    alignSelf: 'flex-start',
    marginLeft: 2,
    marginTop: -2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  dateBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNumber: {
    fontSize: 12,
    lineHeight: 15,
  },
  dateNumberOverCover: {
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 2,
    fontWeight: '700',
  },
  feelingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  },
  cellDiaryOverCover: {
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowRadius: 2,
  },
});
