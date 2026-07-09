import { Host, Slider } from '@expo/ui/swift-ui';
import { tint } from '@expo/ui/swift-ui/modifiers';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { FEELINGS, FEELING_NOTION_COLORS, type Feeling } from '@/features/journal/draft';
import { notionChipColor } from '@/features/notion/colors';
import { useTheme } from '@/hooks/use-theme';
import type { NotionSelectColor } from '@/lib/supabase';

type FeelingPickerProps = {
  value: Feeling | null;
  onChange: (next: Feeling | null) => void;
  /**
   * Notion select color per feeling, learned from already-saved entries.
   * Options without a known color fall back to the Notion `default` palette.
   */
  colorMap?: Partial<Record<Feeling, NotionSelectColor | null>>;
};

/**
 * Mood slider: FEELINGS is an ordered scale (best → worst), rendered as
 * the system SwiftUI Slider — the genuine liquid-glass control on iOS 26 —
 * with 5 stops. While dragging, the nearest feeling previews in the value
 * chip; the value commits when the finger lifts (onEditingChanged false).
 * Tapping the value chip clears the feeling.
 */
export function FeelingPicker({ value, onChange, colorMap }: FeelingPickerProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  const [preview, setPreview] = useState<Feeling | null>(null);
  const previewRef = useRef<Feeling | null>(null);

  const shown = preview ?? value;
  const chip = shown
    ? notionChipColor(colorMap?.[shown] ?? FEELING_NOTION_COLORS[shown], scheme)
    : null;
  // With nothing selected the thumb parks in the middle; the chip carries
  // the "unset" state, not the slider position.
  const sliderValue = FEELINGS.indexOf(shown ?? FEELINGS[2]);

  return (
    <View style={styles.row}>
      {/* SwiftUI views only lay out inside a Host, which carries the RN size. */}
      <Host style={styles.sliderWrap}>
        <Slider
          min={0}
          max={FEELINGS.length - 1}
          step={1}
          value={sliderValue}
          modifiers={[tint(chip ? chip.text : theme.accent)]}
          onValueChange={(v) => {
            const idx = Math.min(FEELINGS.length - 1, Math.max(0, Math.round(v)));
            previewRef.current = FEELINGS[idx];
            setPreview(FEELINGS[idx]);
          }}
          onEditingChanged={(editing) => {
            if (editing) return;
            const next = previewRef.current;
            previewRef.current = null;
            setPreview(null);
            if (next) onChange(next);
          }}
        />
      </Host>
      <Pressable
        onPress={() => {
          if (value) onChange(null);
        }}
        accessibilityRole="button"
        accessibilityLabel={value ? '気分をクリア' : '気分'}
        style={[
          styles.valueChip,
          { backgroundColor: chip ? chip.background : theme.backgroundElement },
        ]}>
        <ThemedText
          type="small"
          style={{
            color: chip ? chip.text : theme.textSecondary,
            fontWeight: '600',
          }}
          numberOfLines={1}>
          {shown ?? '気分'}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sliderWrap: {
    flex: 1,
    height: 32,
    justifyContent: 'center',
  },
  valueChip: {
    minWidth: 64,
    height: 28,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
});
