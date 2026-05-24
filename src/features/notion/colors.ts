/**
 * Notion select/multi_select color → app palette.
 *
 * Notion exposes a fixed palette of ten color names. We mirror Notion's
 * own chip styling (tinted background + darker text) per light/dark mode
 * so calendar chips feel native to anyone used to Notion.
 *
 * Source palette: Notion's UI for select chips. Values picked to match
 * perceived saturation in both schemes — the dark-mode background is
 * deliberately desaturated so chips don't fight the surrounding UI.
 */

import type { NotionSelectColor } from '@/lib/supabase';

type ChipColor = { background: string; text: string };

const LIGHT: Record<NotionSelectColor, ChipColor> = {
  default: { background: '#EBECED', text: '#37352F' },
  gray: { background: '#E3E2E0', text: '#32302C' },
  brown: { background: '#EEE0DA', text: '#64473A' },
  orange: { background: '#FADEC9', text: '#D9730D' },
  yellow: { background: '#FDECC8', text: '#DFAB01' },
  green: { background: '#DBEDDB', text: '#0F7B6C' },
  blue: { background: '#D3E5EF', text: '#0B6E99' },
  purple: { background: '#E8DEEE', text: '#6940A5' },
  pink: { background: '#F5E0E9', text: '#AD1A72' },
  red: { background: '#FFE2DD', text: '#E03E3E' },
};

const DARK: Record<NotionSelectColor, ChipColor> = {
  default: { background: '#2F2F2F', text: '#D4D4D4' },
  gray: { background: '#3A3A3A', text: '#9B9B9B' },
  brown: { background: '#4A3228', text: '#BA856F' },
  orange: { background: '#5C3B23', text: '#C77D48' },
  yellow: { background: '#564328', text: '#CA9849' },
  green: { background: '#243D30', text: '#4DAB9A' },
  blue: { background: '#143A4E', text: '#447ACB' },
  purple: { background: '#3C2D49', text: '#9D68D3' },
  pink: { background: '#4E2C3C', text: '#D15796' },
  red: { background: '#522E2A', text: '#DF5452' },
};

export function notionChipColor(
  color: NotionSelectColor | null | undefined,
  scheme: 'light' | 'dark',
): ChipColor {
  const palette = scheme === 'dark' ? DARK : LIGHT;
  return palette[color ?? 'default'];
}
