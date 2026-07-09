import { useRouter } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Palettes, Spacing, type PaletteKey } from '@/constants/theme';
import { usePalette } from '@/features/settings/palette-context';
import { useTheme } from '@/hooks/use-theme';

const PALETTE_ORDER: PaletteKey[] = [
  'terracotta',
  'cream',
  'kinari',
  'white',
  'greige',
  'coolGray',
];

/**
 * デザイン (palette) picker — its own screen so each option can afford a
 * real preview card: the option's own ground, a mock of the today marker /
 * 保存 pill / 今日 chip painted in its tokens, applied on tap.
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
              <View style={styles.cardHead}>
                <ThemedText type="smallBold" style={{ color: l.text }}>
                  {option.label}
                </ThemedText>
                {selected && <Check size={16} color={l.accent} strokeWidth={2.5} />}
              </View>
              {/* Mini mock in the option's own tokens. */}
              <View style={styles.mockRow}>
                <View style={[styles.mockToday, { backgroundColor: l.accent }]}>
                  <ThemedText type="small" style={{ color: l.background, fontWeight: '600' }}>
                    9
                  </ThemedText>
                </View>
                <View style={[styles.mockPill, { backgroundColor: l.accent }]}>
                  <ThemedText type="small" style={{ color: l.background, fontWeight: '600' }}>
                    保存
                  </ThemedText>
                </View>
                <View style={[styles.mockPill, { backgroundColor: l.accentSoft }]}>
                  <ThemedText type="small" style={{ color: l.accent, fontWeight: '600' }}>
                    今日
                  </ThemedText>
                </View>
                <View style={[styles.mockChip, { backgroundColor: l.backgroundElement }]}>
                  <ThemedText type="small" style={{ color: l.textSecondary }}>
                    Aa
                  </ThemedText>
                </View>
                <View style={styles.mockPhoto} />
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
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  mockToday: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockPill: {
    height: 28,
    paddingHorizontal: Spacing.three,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockPhoto: {
    width: 28,
    height: 38,
    borderRadius: 8,
    // Photo stand-in: fixed gradient-ish tone, palette-independent.
    backgroundColor: '#9C8A76',
  },
});
