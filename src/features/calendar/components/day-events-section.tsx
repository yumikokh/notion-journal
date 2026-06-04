import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CalendarEvent } from '@/lib/supabase';

import { useDayEvents } from '../use-day-events';

/**
 * Inline events list for the DayDrawer.
 *
 * Renders nothing when Google Calendar isn't connected (the Settings
 * screen surfaces the connect CTA), so the drawer stays clean for
 * users who don't link a calendar.
 */
export function DayEventsSection({ date }: { date: string }) {
  const theme = useTheme();
  const query = useDayEvents(date);

  // `enabled=false` keeps fetchStatus 'idle' — no UI when disconnected.
  if (query.fetchStatus === 'idle' && !query.data) return null;

  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
        📅 予定
      </ThemedText>
      <View style={[styles.list, { backgroundColor: theme.backgroundElement }]}>
        {query.isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator />
          </View>
        ) : query.error ? (
          <ThemedText type="small" themeColor="textSecondary">
            予定を取得できませんでした
          </ThemedText>
        ) : (query.data?.length ?? 0) === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            予定なし
          </ThemedText>
        ) : (
          query.data!.map((ev, i) => <EventRow key={`${ev.start}-${i}`} event={ev} />)
        )}
      </View>
    </View>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  const timeLabel = formatRange(event.start, event.end);
  return (
    <View style={styles.row}>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        style={styles.time}
        numberOfLines={1}>
        {timeLabel}
      </ThemedText>
      <ThemedText style={styles.summary} numberOfLines={2}>
        {event.summary || '(無題)'}
      </ThemedText>
    </View>
  );
}

/**
 * Google returns either RFC3339 datetimes (timed events) or YYYY-MM-DD
 * strings (all-day events). All-day events surface as `終日`; timed
 * events show `HH:MM–HH:MM` in the device's local tz.
 */
export function formatRange(start: string, end: string): string {
  const allDay = isDateOnly(start);
  if (allDay) return '終日';
  return `${formatTime(start)}–${formatTime(end)}`;
}

function isDateOnly(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  label: {
    textTransform: 'uppercase',
  },
  list: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  loadingRow: {
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  time: {
    width: 96,
    fontVariant: ['tabular-nums'],
  },
  summary: {
    flex: 1,
  },
});
