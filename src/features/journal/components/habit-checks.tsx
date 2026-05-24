import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { HABITS, type HabitKey } from '@/features/journal/draft';
import { habitIcon } from '@/features/journal/habit-icons';
import { useTheme } from '@/hooks/use-theme';

type HabitChecksProps = {
  value: Record<HabitKey, boolean>;
  onToggle: (key: HabitKey) => void;
};

/**
 * Icon-only habit chips. The label lives in `accessibilityLabel` so VoiceOver
 * and `title` (web hover tooltip) still surface it — the visual chip stays
 * compact for a dense row of 5+ habits.
 */
export function HabitChecks({ value, onToggle }: HabitChecksProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {HABITS.map(({ key, label }) => {
        const on = value[key];
        const Icon = habitIcon(key);
        // Selected chips invert to the theme's high-contrast color
        // (black in light mode, white in dark mode), matching the primary
        // 保存 / AI button styling.
        const bg = on ? theme.text : theme.backgroundElement;
        const fg = on ? theme.background : theme.textSecondary;
        return (
          <Pressable
            key={key}
            accessibilityRole="switch"
            accessibilityLabel={label}
            accessibilityHint={`${label} の習慣を切り替える`}
            accessibilityState={{ checked: on }}
            onPress={() => onToggle(key)}
            style={[styles.chip, { backgroundColor: bg }]}>
            <Icon size={18} color={fg} strokeWidth={2} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  chip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
