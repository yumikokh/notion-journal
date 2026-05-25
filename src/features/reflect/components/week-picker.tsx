import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import {
  formatWeekLabel,
  relativeWeekLabel,
  type WeekRange,
} from '../week-range';

type Props = {
  range: WeekRange;
  today: Date;
  onPrev: () => void;
  onNext: () => void;
  /** Disable the "next" button when the user is already on the current week. */
  canGoNext: boolean;
};

export function WeekPicker({ range, today, onPrev, onNext, canGoNext }: Props) {
  const theme = useTheme();
  const relative = relativeWeekLabel(range, today);
  const dateLabel = formatWeekLabel(range);

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPrev}
        hitSlop={Spacing.three}
        style={({ pressed }) => [
          styles.iconButton,
          { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
        ]}
        accessibilityLabel="前の週">
        <ChevronLeft size={20} color={theme.text} />
      </Pressable>

      <View style={styles.labelGroup}>
        <ThemedText type="subtitle" style={styles.title}>
          {relative ?? dateLabel}
        </ThemedText>
        {relative ? (
          <ThemedText themeColor="textSecondary" type="small">
            {dateLabel}
          </ThemedText>
        ) : null}
      </View>

      <Pressable
        onPress={canGoNext ? onNext : undefined}
        hitSlop={Spacing.three}
        disabled={!canGoNext}
        style={({ pressed }) => [
          styles.iconButton,
          {
            backgroundColor: theme.backgroundElement,
            opacity: !canGoNext ? 0.3 : pressed ? 0.6 : 1,
          },
        ]}
        accessibilityLabel="次の週">
        <ChevronRight size={20} color={theme.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelGroup: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
  },
});
