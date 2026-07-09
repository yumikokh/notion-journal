import { useEffect, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  useColorScheme,
  type PanResponderInstance,
} from 'react-native';

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

const TRACK_PAD = Spacing.three;
const STOP_W = 24;

/**
 * Mood gauge: FEELINGS is an ordered scale (best → worst), so it renders
 * as a compact track of five tinted dots instead of five large kaomoji
 * buttons. Tap a dot or drag along the track like a slider — while
 * dragging, the nearest dot previews live and the value commits on
 * release. The selected dot grows to full color and its kaomoji shows as
 * a chip on the right; tapping the selected dot again clears the feeling.
 */
export function FeelingPicker({ value, onChange, colorMap }: FeelingPickerProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  // Drag preview: which dot the finger is over, before commit-on-release.
  const [preview, setPreview] = useState<Feeling | null>(null);
  const [trackW, setTrackW] = useState(0);

  // Pan handlers are created once; they read the latest layout/props via a
  // ref (updated in an effect — writing refs during render is unsafe).
  const live = useRef({ trackW: 0, onChange });
  useEffect(() => {
    live.current = { trackW, onChange };
  }, [trackW, onChange]);

  // Created inside an effect (not render) so the callbacks' ref reads are
  // legal for react-hooks/refs; they only ever run from touch events.
  const [pan, setPan] = useState<PanResponderInstance | null>(null);
  useEffect(() => {
    const feelingAtX = (x: number): Feeling => {
      const usable = live.current.trackW - TRACK_PAD * 2 - STOP_W;
      const step = usable > 0 ? usable / (FEELINGS.length - 1) : 1;
      const raw = Math.round((x - TRACK_PAD - STOP_W / 2) / step);
      const idx = Math.min(FEELINGS.length - 1, Math.max(0, raw));
      return FEELINGS[idx];
    };
    setPan(
      PanResponder.create({
        // Capture only real horizontal drags so plain taps still reach the dots.
        onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dx) > 6,
        onPanResponderMove: (e) => setPreview(feelingAtX(e.nativeEvent.locationX)),
        onPanResponderRelease: (e) => {
          live.current.onChange(feelingAtX(e.nativeEvent.locationX));
          setPreview(null);
        },
        onPanResponderTerminate: () => setPreview(null),
      }),
    );
  }, []);

  const shown = preview ?? value;
  const selectedChip = shown
    ? notionChipColor(colorMap?.[shown] ?? FEELING_NOTION_COLORS[shown], scheme)
    : null;

  return (
    <View style={styles.row}>
      <View
        style={[styles.track, { backgroundColor: theme.backgroundElement }]}
        onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
        {...(pan?.panHandlers ?? {})}>
        <View style={[styles.trackLine, { backgroundColor: theme.backgroundSelected }]} />
        {FEELINGS.map((feeling) => {
          const selected = shown === feeling;
          const chip = notionChipColor(
            colorMap?.[feeling] ?? FEELING_NOTION_COLORS[feeling],
            scheme,
          );
          return (
            <Pressable
              key={feeling}
              accessibilityRole="button"
              accessibilityLabel={`Feeling ${feeling}`}
              accessibilityState={{ selected }}
              hitSlop={10}
              onPress={() => onChange(value === feeling ? null : feeling)}
              style={styles.stop}>
              <View
                style={[
                  selected ? styles.dotSelected : styles.dot,
                  { backgroundColor: chip.background },
                  !selected && styles.dotIdle,
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View
        style={[
          styles.valueChip,
          { backgroundColor: selectedChip ? selectedChip.background : theme.backgroundElement },
        ]}>
        <ThemedText
          type="small"
          style={{
            color: selectedChip ? selectedChip.text : theme.textSecondary,
            fontWeight: '600',
          }}
          numberOfLines={1}>
          {shown ?? '気分'}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  track: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 32,
    borderRadius: 16,
    paddingHorizontal: TRACK_PAD,
  },
  trackLine: {
    position: 'absolute',
    left: TRACK_PAD + 4,
    right: TRACK_PAD + 4,
    height: 2,
    borderRadius: 1,
  },
  stop: {
    alignItems: 'center',
    justifyContent: 'center',
    width: STOP_W,
    height: 32,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotIdle: {
    opacity: 0.55,
  },
  dotSelected: {
    width: 20,
    height: 20,
    borderRadius: 10,
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
