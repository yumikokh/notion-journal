import type { CalendarEvent } from '@/lib/supabase';

const ALL_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Format an ISO instant as HH:MM in JST. Times are always rendered in
 * Asia/Tokyo since this is a personal-use tool used in Japan; keeping the
 * timezone fixed also makes the output deterministic across machines.
 */
function formatTimeJst(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/**
 * Build a markdown list of a single day's calendar events for the AI
 * highlight prompt. Returns an empty string when there are no events, so
 * callers can pass the result straight through (an empty block means
 * "journal-only", identical to the pre-calendar behavior).
 *
 * The events are expected to all fall on the same day (as produced by
 * `useDayEvents`); they are sorted by start so the prompt reads
 * chronologically regardless of cache ordering.
 */
export function buildDayCalendarContext(events: CalendarEvent[]): string {
  if (events.length === 0) return '';
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start));
  const rows = sorted.map((ev) => {
    const title = ev.summary?.trim() || '(無題)';
    const time = ALL_DAY_RE.test(ev.start)
      ? '終日'
      : `${formatTimeJst(ev.start)}–${formatTimeJst(ev.end)}`;
    const desc = ev.description?.trim()
      ? ` — ${ev.description.trim().replace(/\s+/g, ' ').slice(0, 120)}`
      : '';
    return `- ${time} ${title}${desc}`;
  });
  return rows.join('\n');
}
