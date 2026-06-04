/**
 * Color assignments for the Insights dashboard.
 *
 * Reuses the existing Notion select palette (`notionChipColor`) so the charts
 * feel native to the rest of the app rather than introducing ad-hoc brand
 * colors. Feelings get a green→red scale (happy→sad); habits each get a
 * distinct hue so the bars read at a glance.
 */

import { type Feeling, type HabitKey } from '@/features/journal/draft';
import { notionChipColor } from '@/features/notion/colors';
import type { NotionSelectColor } from '@/lib/supabase';

export type Scheme = 'light' | 'dark';

/** Feeling face → Notion color, best (^^) → worst (`A´). */
const FEELING_COLOR: Record<Feeling, NotionSelectColor> = {
  '(^^)': 'green',
  '(˙-˙)': 'blue',
  '(- -)': 'yellow',
  '(TT)': 'orange',
  '(`A´)': 'red',
};

/** Habit → Notion color, kept stable so each habit owns a recognizable hue. */
const HABIT_COLOR: Record<HabitKey, NotionSelectColor> = {
  output: 'blue',
  book: 'green',
  design: 'purple',
  english: 'orange',
  exercise: 'red',
};

/** Feeling scores 1..5 mapped low→high; used to tint trend points by value. */
const SCORE_COLORS: NotionSelectColor[] = ['red', 'orange', 'yellow', 'blue', 'green'];

export function feelingColor(feeling: Feeling, scheme: Scheme) {
  return notionChipColor(FEELING_COLOR[feeling], scheme);
}

export function habitColor(key: HabitKey, scheme: Scheme) {
  return notionChipColor(HABIT_COLOR[key], scheme);
}

/** Tint for a (possibly fractional) feeling score, rounded to the nearest band. */
export function scoreColor(score: number, scheme: Scheme) {
  const idx = Math.min(SCORE_COLORS.length - 1, Math.max(0, Math.round(score) - 1));
  return notionChipColor(SCORE_COLORS[idx], scheme);
}

/** Primary accent for the trend line / area fill. */
export function accentColor(scheme: Scheme) {
  return notionChipColor('blue', scheme).text;
}
