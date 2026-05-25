import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle } from '@expo/ui/swift-ui/modifiers';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { rescheduleFromCache } from '../reschedule-from-cache';
import {
  DEFAULT_REMINDER_SETTINGS,
  loadReminderSettings,
  saveReminderSettings,
  type ReminderSettings,
  type Weekday,
} from '../reminder-prefs';

/**
 * Settings UI for daily / weekly reminders.
 *
 * Every change is persisted immediately and triggers a reschedule, so the
 * "scheduled set" on the device always matches what the UI shows. This
 * mirrors how iOS Settings handles toggles — no save button.
 */
export function ReminderSection() {
  const theme = useTheme();
  const qc = useQueryClient();
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadReminderSettings().then((s) => {
      setSettings(s);
      setLoaded(true);
    });
  }, []);

  const update = (next: ReminderSettings) => {
    setSettings(next);
    void saveReminderSettings(next).then(() => rescheduleFromCache(qc));
  };

  if (!loaded) return null;

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
        リマインダー
      </ThemedText>

      {/* Daily reminder */}
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.row}>
          <ThemedText style={styles.cardTitle}>毎日のリマインダー</ThemedText>
          <Switch
            value={settings.dailyEnabled}
            onValueChange={(dailyEnabled) => update({ ...settings, dailyEnabled })}
          />
        </View>

        {settings.dailyEnabled && (
          <>
            <View style={styles.row}>
              <ThemedText themeColor="textSecondary">通知時刻</ThemedText>
              <TimeInline
                hhmm={settings.dailyTime}
                onChange={(dailyTime) => update({ ...settings, dailyTime })}
              />
            </View>

            <View style={styles.weekdayWrap}>
              <ThemedText themeColor="textSecondary" type="small">
                通知する曜日
              </ThemedText>
              <WeekdayPicker
                value={settings.dailyDays}
                onChange={(dailyDays) => update({ ...settings, dailyDays })}
              />
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <ThemedText>記録済みの日はスキップ</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  その日に Notion へ書き込み済みなら通知しません
                </ThemedText>
              </View>
              <Switch
                value={settings.skipIfRecorded}
                onValueChange={(skipIfRecorded) => update({ ...settings, skipIfRecorded })}
              />
            </View>
          </>
        )}
      </View>

      {/* Weekly reminder */}
      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.row}>
          <ThemedText style={styles.cardTitle}>ウィークリーふりかえり</ThemedText>
          <Switch
            value={settings.weeklyEnabled}
            onValueChange={(weeklyEnabled) => update({ ...settings, weeklyEnabled })}
          />
        </View>

        {settings.weeklyEnabled && (
          <>
            <View style={styles.row}>
              <ThemedText themeColor="textSecondary">通知時刻</ThemedText>
              <TimeInline
                hhmm={settings.weeklyTime}
                onChange={(weeklyTime) => update({ ...settings, weeklyTime })}
              />
            </View>
            <View style={styles.weekdayWrap}>
              <ThemedText themeColor="textSecondary" type="small">
                通知する曜日
              </ThemedText>
              <WeekdayPicker
                single
                value={[settings.weeklyDay]}
                onChange={(days) => {
                  const next = days[0] ?? settings.weeklyDay;
                  update({ ...settings, weeklyDay: next });
                }}
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// ─── inline time picker ────────────────────────────────────────────────
//
// We bypass `@expo/ui/community/datetime-picker`'s wrapper because it
// pins `matchContents={{ vertical: true }}` on its `Host`, which leaves
// horizontal sizing to flexbox and collapses the picker to zero width
// inside a `space-between` row — taps then have no hit target. By driving
// `Host` directly we can match both axes to the SwiftUI compact button
// so the tap area is exactly the rendered chip.

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

function hhmmToDate(hhmm: string): Date {
  const m = TIME_RE.exec(hhmm);
  const h = m ? Number(m[1]) : 0;
  const min = m ? Number(m[2]) : 0;
  const d = new Date();
  d.setHours(h, min, 0, 0);
  return d;
}

function dateToHhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function TimeInline({
  hhmm,
  onChange,
}: {
  hhmm: string;
  onChange: (next: string) => void;
}) {
  return (
    <Host matchContents>
      <DatePicker
        selection={hhmmToDate(hhmm)}
        displayedComponents={['hourAndMinute']}
        onDateChange={(d: Date) => onChange(dateToHhmm(d))}
        modifiers={[datePickerStyle('compact')]}
      />
    </Host>
  );
}

// ─── weekday picker ────────────────────────────────────────────────────

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 1, label: '月' },
  { value: 2, label: '火' },
  { value: 3, label: '水' },
  { value: 4, label: '木' },
  { value: 5, label: '金' },
  { value: 6, label: '土' },
  { value: 7, label: '日' },
];

function WeekdayPicker({
  value,
  onChange,
  single = false,
}: {
  value: readonly Weekday[];
  onChange: (next: Weekday[]) => void;
  /** When true, only one weekday can be selected (weekly reminder). */
  single?: boolean;
}) {
  const theme = useTheme();
  const selected = new Set(value);

  const toggle = (day: Weekday) => {
    if (single) {
      onChange([day]);
      return;
    }
    const next = new Set(selected);
    if (next.has(day)) {
      // Disallow deselecting the last day — confusing UX (silently disables).
      if (next.size === 1) return;
      next.delete(day);
    } else {
      next.add(day);
    }
    onChange(Array.from(next).sort((a, b) => a - b) as Weekday[]);
  };

  return (
    <View style={styles.chipRow}>
      {WEEKDAYS.map((d) => {
        const on = selected.has(d.value);
        return (
          <Pressable
            key={d.value}
            onPress={() => toggle(d.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[
              styles.chip,
              {
                // Match calendar-screen's `chipToggle`: solid fill, no border,
                // backgroundSelected (= theme-aware near-black) when on.
                backgroundColor: on ? theme.backgroundSelected : theme.background,
              },
            ]}>
            <ThemedText
              type="smallBold"
              themeColor={on ? 'text' : 'textSecondary'}>
              {d.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  sectionLabel: {
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  weekdayWrap: {
    gap: Spacing.two,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    minWidth: 36,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.four,
    alignItems: 'center',
  },
  cardTitle: {
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
  },
});
