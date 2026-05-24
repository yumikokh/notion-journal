import {
  Activity,
  BookOpen,
  Globe,
  Image as ImageIcon,
  Palette,
  Pencil,
  PenLine,
  SquareCheck,
  type LucideIcon,
} from 'lucide-react-native';

/**
 * Habit / display-toggle icons.
 *
 * Notion (web) renders its UI with Lucide icons; using the same library
 * keeps the calendar visually consistent with the source-of-truth tool.
 * Notion's API does not expose per-checkbox-property icons, so we map
 * known habit names to specific Lucide glyphs on the app side and fall
 * back to a generic check-box for unknown names.
 */

const KNOWN_HABIT_ICONS: Record<string, LucideIcon> = {
  output: Pencil,
  book: BookOpen,
  design: Palette,
  english: Globe,
  exercise: Activity,
};

const FALLBACK_HABIT_ICON: LucideIcon = SquareCheck;

export function habitIcon(name: string): LucideIcon {
  return KNOWN_HABIT_ICONS[name.toLowerCase()] ?? FALLBACK_HABIT_ICON;
}

export const DIARY_TOGGLE_ICON: LucideIcon = PenLine;
export const COVER_TOGGLE_ICON: LucideIcon = ImageIcon;
