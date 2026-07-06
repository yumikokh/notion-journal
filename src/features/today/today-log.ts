/**
 * The きょう (Today) tab's quick-capture log format.
 *
 * Each capture is appended to the daily page body as its own paragraph:
 *
 *   **HH:MM** first line of the fragment
 *   optional following lines of the same fragment
 *
 * The timeline view parses these back out of the body markdown; body
 * content that doesn't match the marker (AI summaries, free writing done
 * in the drawer, images…) is simply not part of the timeline — the full
 * body stays visible in the day drawer.
 */

export type TodayLog = {
  /** HH:MM label the fragment was captured at. */
  time: string;
  text: string;
};

const LOG_MARKER = /^\*\*(\d{1,2}:\d{2})\*\*\s?(.*)$/;
/**
 * Notion's markdown export renders non-text blocks as raw HTML-ish lines —
 * `<empty-block/>`, `<video src="…"></video>`, … — and free-form editing
 * on the Notion side sprinkles these in. They never read well in the
 * timeline; treat any pure-tag line like a blank line (fragment
 * terminator), keeping only the human-written text.
 */
const PSEUDO_TAG = /^<.*>$/;

/** Format a Date as the HH:MM label used in log lines. */
export function formatTimeLabel(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** The markdown appended to the page body for one captured fragment. */
export function buildLogLine(timeLabel: string, text: string): string {
  return `**${timeLabel}** ${text.trim()}`;
}

/**
 * Extract the captured fragments from a page body. A `**HH:MM**` marker
 * starts a fragment; following non-blank lines without a marker belong to
 * it. A blank line or the next marker ends it.
 */
export function parseTodayLogs(bodyMarkdown: string): TodayLog[] {
  const logs: TodayLog[] = [];
  let open: TodayLog | null = null;

  for (const line of bodyMarkdown.split('\n')) {
    const match = line.match(LOG_MARKER);
    if (match) {
      open = { time: match[1], text: match[2] };
      logs.push(open);
      continue;
    }
    if (line.trim() === '' || PSEUDO_TAG.test(line.trim())) {
      open = null;
      continue;
    }
    if (open) {
      open.text = open.text.length > 0 ? `${open.text}\n${line}` : line;
    }
  }
  return logs.map((log) => ({ ...log, text: log.text.trim() }));
}
