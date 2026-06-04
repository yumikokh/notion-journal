import { useQuery } from '@tanstack/react-query';

import { invokeGoogleCalendarList, type CalendarEvent } from '@/lib/supabase';

import { useGoogleConnection } from './use-google-connection';

/**
 * Build the [00:00, next 00:00) local-time range for a YYYY-MM-DD key as
 * ISO 8601 with offset, ready for Google Calendar's `timeMin` / `timeMax`.
 */
export function buildDayRangeIso(dateKey: string): { timeMin: string; timeMax: string } {
  const [y, m, d] = dateKey.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

/**
 * Fetch the day's calendar events. Gated on Google Calendar being
 * connected — until then no requests fire. Result is cached per date
 * key, so reopening the DayDrawer for the same day reads from cache.
 */
export function useDayEvents(dateKey: string | null) {
  const { status } = useGoogleConnection();
  const connected = status.data?.connected === true;
  const enabled = connected && !!dateKey;

  return useQuery<CalendarEvent[]>({
    queryKey: ['day-events', dateKey],
    queryFn: async () => {
      if (!dateKey) return [];
      const range = buildDayRangeIso(dateKey);
      const res = await invokeGoogleCalendarList(range);
      return res.events;
    },
    enabled,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}
