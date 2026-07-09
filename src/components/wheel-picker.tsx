import { useRef } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  useColorScheme,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type WheelPickerItem = {
  key: string;
  label: string;
  /** Optional pill rendered after the label (e.g. 未記入). */
  badge?: string;
};

type WheelPickerProps = {
  items: WheelPickerItem[];
  /** Index sitting in the center band when the wheel mounts. */
  initialIndex: number;
  /** Fires with the centered index every time the wheel settles. */
  onChange: (index: number) => void;
  itemHeight?: number;
  /** Rows visible at once — odd, so one row sits exactly in the middle. */
  visibleCount?: number;
  /**
   * Row alignment. Side-by-side columns align toward the drum's center
   * axis (left column `right`, right column `left`) so the rotation axes
   * read as one.
   */
  align?: 'left' | 'center' | 'right';
};

/**
 * Drum-roll picker built on a snapping FlatList — no native picker module,
 * so it runs on the existing dev client. Rows snap into the fixed center
 * band; unlike a bounded list view, the roll makes a long value range feel
 * endless instead of like a wall of rows.
 */
export function WheelPicker({
  items,
  initialIndex,
  onChange,
  itemHeight = 44,
  visibleCount = 5,
  align = 'center',
}: WheelPickerProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  // Spacer above/below lets the first & last item reach the center band.
  const pad = (itemHeight * (visibleCount - 1)) / 2;

  const listRef = useRef<FlatList<WheelPickerItem>>(null);
  // The static contentOffset prop gets dropped when the spacers mount, so
  // position the wheel once the list's content size is actually known.
  const positioned = useRef(false);
  const positionOnce = () => {
    if (positioned.current) return;
    positioned.current = true;
    listRef.current?.scrollToOffset({ offset: initialIndex * itemHeight, animated: false });
  };

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.y / itemHeight);
    onChange(Math.max(0, Math.min(items.length - 1, index)));
  };

  return (
    <View style={{ height: itemHeight * visibleCount }}>
      {/* Selection band UNDER the rows (text stays on top of the fill). */}
      <View
        pointerEvents="none"
        style={[
          styles.band,
          {
            top: pad,
            height: itemHeight,
            backgroundColor:
              scheme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.45)',
          },
        ]}
      />
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => item.key}
        getItemLayout={(_, index) => ({
          length: itemHeight,
          // Items sit below the pad spacer in the content coordinates.
          offset: pad + itemHeight * index,
          index,
        })}
        renderItem={({ item }) => (
          <View
            style={[
              styles.row,
              { height: itemHeight },
              align === 'left' && styles.rowLeft,
              align === 'right' && styles.rowRight,
            ]}>
            <ThemedText>{item.label}</ThemedText>
            {item.badge ? (
              <View style={[styles.badge, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText style={styles.badgeText} themeColor="textSecondary">
                  {item.badge}
                </ThemedText>
              </View>
            ) : null}
          </View>
        )}
        ListHeaderComponent={<View style={{ height: pad }} />}
        ListFooterComponent={<View style={{ height: pad }} />}
        // With the pad spacers, offset i×itemHeight centers item i — so the
        // initial offset needs no correction and snapping stays aligned.
        onContentSizeChange={positionOnce}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        onMomentumScrollEnd={settle}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  rowLeft: {
    justifyContent: 'flex-start',
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  band: {
    position: 'absolute',
    left: Spacing.two,
    right: Spacing.two,
    borderRadius: 10,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
});
