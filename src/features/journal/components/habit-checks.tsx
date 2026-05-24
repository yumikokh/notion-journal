import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { HABITS, type HabitKey } from '@/features/journal/draft';
import { useTheme } from '@/hooks/use-theme';

type HabitChecksProps = {
  value: Record<HabitKey, boolean>;
  onToggle: (key: HabitKey) => void;
};

export function HabitChecks({ value, onToggle }: HabitChecksProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {HABITS.map(({ key, label }) => {
        const on = value[key];
        return (
          <Pressable
            key={key}
            accessibilityRole="switch"
            accessibilityLabel={`Habit ${label}`}
            accessibilityState={{ checked: on }}
            onPress={() => onToggle(key)}
            style={[
              styles.chip,
              {
                backgroundColor: on ? theme.backgroundSelected : theme.backgroundElement,
              },
            ]}>
            <ThemedText type="small" themeColor={on ? 'text' : 'textSecondary'}>
              {on ? '✓ ' : ''}
              {label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.one,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
  },
});
