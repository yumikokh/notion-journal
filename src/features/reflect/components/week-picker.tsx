import { ChevronDown } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { WheelPicker } from '@/components/wheel-picker';
import { WheelSheet } from '@/components/wheel-sheet';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { UnreflectedBadge } from './unreflected-badge';
import { useReflectedWeeks } from '../use-reflected-weeks';
import {
  formatWeekLabel,
  groupWeeksByMonth,
  relativeWeekLabel,
  weekName,
  type WeekRange,
} from '../week-range';

type Props = {
  /** All pager weeks, oldest → newest. */
  weeks: WeekRange[];
  /** Index of the visible week within `weeks`. */
  index: number;
  today: Date;
  /** Wheel jumps land instantly (animated=false). */
  onSelect: (index: number, animated: boolean) => void;
};

/** Split a Monday key into its picker coordinates. */
function coords(week: WeekRange): { year: number; month: number } {
  const [year, month] = week.start.split('-').map(Number);
  return { year, month };
}

/**
 * Week header: a tappable title (week name + date range) that opens an
 * iOS-date-picker-style sheet with 年 / 月 / 週 columns, so each column
 * stays a handful of rows no matter how far the history reaches. No ‹ ›
 * here — horizontal swiping on the pager itself covers single steps. A
 * 未記入 badge marks weeks whose reflection isn't saved yet.
 */
export function WeekPicker({ weeks, index, today, onSelect }: Props) {
  const theme = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  const reflectedWeeks = useReflectedWeeks().data;

  const groups = useMemo(() => groupWeeksByMonth(weeks), [weeks]);
  const years = useMemo(() => [...new Set(groups.map((g) => g.year))], [groups]);
  const monthsOf = (year: number) =>
    groups.filter((g) => g.year === year).map((g) => g.month);
  const weeksOf = (year: number, month: number) =>
    groups.find((g) => g.year === year && g.month === month)?.weeks ?? [];

  const range = weeks[index];
  const relative = relativeWeekLabel(range, today);

  // Column selections; committed only via この週へ.
  const [selYear, setSelYear] = useState(coords(range).year);
  const [selMonth, setSelMonth] = useState(coords(range).month);
  const [selWeekIdx, setSelWeekIdx] = useState(0);

  const openPicker = () => {
    const { year, month } = coords(range);
    setSelYear(year);
    setSelMonth(month);
    setSelWeekIdx(Math.max(0, weeksOf(year, month).findIndex((w) => w.start === range.start)));
    setPickerOpen(true);
  };

  // Keep the dependent columns valid when an upper column turns.
  const clampWeekIdx = (year: number, month: number) => {
    setSelWeekIdx((prev) => Math.min(prev, Math.max(0, weeksOf(year, month).length - 1)));
  };
  const handleYear = (year: number) => {
    const months = monthsOf(year);
    const month = months.includes(selMonth)
      ? selMonth
      : months.reduce((best, m) =>
          Math.abs(m - selMonth) < Math.abs(best - selMonth) ? m : best,
        );
    setSelYear(year);
    setSelMonth(month);
    clampWeekIdx(year, month);
  };
  const handleMonth = (month: number) => {
    setSelMonth(month);
    clampWeekIdx(selYear, month);
  };

  const confirm = () => {
    const options = weeksOf(selYear, selMonth);
    const picked = options[Math.min(selWeekIdx, options.length - 1)];
    if (!picked) return;
    const i = weeks.findIndex((w) => w.start === picked.start);
    if (i >= 0 && i !== index) onSelect(i, false);
  };

  // Only mark when the list is actually known — a loading/failed list
  // rendering everything as 未記入 would be a lie.
  const unreflected = (week: WeekRange) =>
    reflectedWeeks != null && !reflectedWeeks.has(week.start);

  const months = monthsOf(selYear);
  const weekOptions = weeksOf(selYear, selMonth);

  return (
    <>
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel="週を選択"
        style={styles.title}>
        <View style={styles.titleRow}>
          <ThemedText type="subtitle">{weekName(range)}</ThemedText>
          <ChevronDown size={16} color={theme.textSecondary} strokeWidth={2} />
        </View>
        <View style={styles.subtitleRow}>
          <ThemedText themeColor="textSecondary" type="small">
            {formatWeekLabel(range)}
            {relative ? `・${relative}` : ''}
          </ThemedText>
          {unreflected(range) ? <UnreflectedBadge /> : null}
        </View>
      </Pressable>

      <WheelSheet
        visible={pickerOpen}
        title="週を選択"
        confirmLabel="この週へ"
        onConfirm={confirm}
        onClose={() => setPickerOpen(false)}>
        <View style={styles.columns}>
          <View style={styles.yearColumn}>
            <WheelPicker
              align="right"
              items={years.map((y) => ({ key: String(y), label: `${y}年` }))}
              initialIndex={Math.max(0, years.indexOf(selYear))}
              onChange={(i) => handleYear(years[i])}
            />
          </View>
          <View style={styles.monthColumn}>
            <WheelPicker
              key={`m-${selYear}`}
              items={months.map((m) => ({ key: String(m), label: `${m}月` }))}
              initialIndex={Math.max(0, months.indexOf(selMonth))}
              onChange={(i) => handleMonth(months[i])}
            />
          </View>
          <View style={styles.weekColumn}>
            <WheelPicker
              key={`w-${selYear}-${selMonth}`}
              align="left"
              items={weekOptions.map((week, i) => ({
                key: week.start,
                label: `第${i + 1}週`,
                badge: unreflected(week) ? '未記入' : undefined,
              }))}
              initialIndex={Math.min(selWeekIdx, Math.max(0, weekOptions.length - 1))}
              onChange={setSelWeekIdx}
            />
          </View>
        </View>
      </WheelSheet>
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    alignItems: 'center',
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  columns: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
  },
  yearColumn: {
    flex: 1,
  },
  monthColumn: {
    flex: 0.8,
  },
  weekColumn: {
    flex: 1.4,
  },
});
