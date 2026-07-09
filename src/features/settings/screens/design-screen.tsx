import { useRouter } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Palettes, Spacing, type PaletteKey } from '@/constants/theme';
import { usePalette } from '@/features/settings/palette-context';
import { useTheme } from '@/hooks/use-theme';

const PALETTE_ORDER: PaletteKey[] = ['coolGray', 'cream', 'terracotta'];

/**
 * デザイン (palette) picker — each option is a card in its own ground with
 * just the accent swatch and name; applied on tap.
 */
export function DesignScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { palette, setPalette } = usePalette();

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.navigate('/settings'))}
          accessibilityRole="button"
          accessibilityLabel="戻る"
          hitSlop={8}
          style={[styles.backBtn, { backgroundColor: theme.backgroundElement }]}>
          <ChevronLeft size={20} color={theme.text} strokeWidth={2} />
        </Pressable>
        <ThemedText type="subtitle">デザイン</ThemedText>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {PALETTE_ORDER.map((key) => {
          const option = Palettes[key];
          const selected = palette === key;
          const l = option.light;
          return (
            <Pressable
              key={key}
              onPress={() => setPalette(key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.card,
                {
                  backgroundColor: l.background,
                  borderColor: selected ? theme.accent : theme.backgroundSelected,
                  borderWidth: selected ? 2 : 1,
                },
              ]}>
              <View style={styles.cardRow}>
                <View style={[styles.accentDot, { backgroundColor: l.accent }]} />
                <ThemedText style={[styles.cardLabel, { color: l.text }]}>
                  {option.label}
                </ThemedText>
                {selected && <Check size={18} color={l.accent} strokeWidth={2.5} />}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  card: {
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three + 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  cardLabel: {
    flex: 1,
    fontWeight: '600',
  },
  accentDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
});
