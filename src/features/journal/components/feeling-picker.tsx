import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { FEELINGS, type Feeling } from '@/features/journal/draft';
import { useTheme } from '@/hooks/use-theme';

type FeelingPickerProps = {
  value: Feeling | null;
  onChange: (next: Feeling | null) => void;
};

export function FeelingPicker({ value, onChange }: FeelingPickerProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {FEELINGS.map((feeling) => {
        const selected = value === feeling;
        return (
          <Pressable
            key={feeling}
            accessibilityRole="button"
            accessibilityLabel={`Feeling ${feeling}`}
            accessibilityState={{ selected }}
            onPress={() => onChange(selected ? null : feeling)}
            style={[
              styles.button,
              {
                backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
              },
            ]}>
            <ThemedText type="default" themeColor={selected ? 'text' : 'textSecondary'}>
              {feeling}
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
    gap: Spacing.two,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
});
