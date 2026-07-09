import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useColorScheme,
  type ViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type BlurCardProps = ViewProps & { intensity?: number; tint?: string };
// The glass material needs expo-blur's native module, which only exists in
// dev clients built after it was added — fall back to an opaque card until
// the next native build instead of crashing the running one.
let BlurCard: ComponentType<BlurCardProps> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  BlurCard = require('expo-blur').BlurView as ComponentType<BlurCardProps>;
} catch {
  BlurCard = null;
}

type WheelSheetProps = {
  visible: boolean;
  title: string;
  /** Confirm button label, e.g. この週へ. */
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  /** Wheel column(s) — layout is the caller's business. */
  children: ReactNode;
};

/**
 * The one bottom-sheet picker shell shared by every "jump to ..." UI
 * (weeks on Reflect, months on the journal list) so they stay identical.
 *
 * RN's Modal animates its whole content — with `slide` the dim overlay
 * rises together with the sheet. Animate manually instead: the overlay
 * fades while only the sheet itself slides up.
 */
export function WheelSheet({
  visible,
  title,
  confirmLabel,
  onConfirm,
  onClose,
  children,
}: WheelSheetProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const insets = useSafeAreaInsets();
  // Lazy useState (not useRef.current) keeps the lint's ref rules happy.
  const [anim] = useState(() => new Animated.Value(0));
  // Keep the modal mounted while the exit animation plays.
  const [rendered, setRendered] = useState(visible);

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing mount state with the controlled `visible` prop is the subscription pattern.
      setRendered(true);
      // Short-travel spring: the card rises a few dozen points and settles,
      // like native iOS panels — not a full-screen slide-up.
      Animated.spring(anim, {
        toValue: 1,
        stiffness: 320,
        damping: 30,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        setRendered(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!rendered) return null;

  const cardContent = (
    <>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.title}>
        {title}
      </ThemedText>
      {children}
      <Pressable
        onPress={() => {
          // The jump lands behind the sheet while it animates out.
          onConfirm();
          onClose();
        }}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.confirm,
          {
            // Same glass family as the selection band, with a tinted label —
            // the iOS 26 button treatment (no opaque slab).
            backgroundColor:
              scheme === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.55)',
            opacity: pressed ? 0.6 : 1,
          },
        ]}>
        {/* theme.text, not accent — terracotta on light glass falls below
            readable contrast, especially over photos showing through. */}
        <ThemedText style={styles.confirmText}>{confirmLabel}</ThemedText>
      </Pressable>
    </>
  );

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={[
          styles.overlay,
          {
            opacity: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1],
              extrapolate: 'clamp',
            }),
          },
        ]}>
        <Pressable
          style={styles.overlayPress}
          accessibilityLabel={`${title}を閉じる`}
          onPress={onClose}
        />
      </Animated.View>
      {/* iOS 26-style floating sheet: an inset glass card above the home
          indicator rather than a panel glued to the screen edges. */}
      <View
        style={[styles.container, { paddingBottom: insets.bottom + Spacing.two }]}
        pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheetShadow,
            {
              // Fade + short rise; the spring may overshoot translateY a
              // hair above 0, which reads as a natural settle.
              opacity: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [56, 0],
                  }),
                },
              ],
            },
          ]}>
          {/* Clip layer: rounds the blur and carries the Liquid Glass rim
              (a bright hairline). Kept separate from the shadow layer —
              overflow:hidden on the same view would clip the shadow too. */}
          <View
            style={[
              styles.sheetClip,
              {
                borderColor:
                  scheme === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.55)',
              },
            ]}>
            {BlurCard ? (
              <BlurCard
                intensity={100}
                // Ultra-thin material: the content behind stays clearly
                // visible, refracted — the "floating on glass" read.
                tint={
                  scheme === 'dark' ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'
                }
                style={styles.sheetCard}>
                {cardContent}
              </BlurCard>
            ) : (
              <View style={[styles.sheetCard, { backgroundColor: theme.background }]}>
                {cardContent}
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Strong enough that the glass card clearly floats in front.
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  overlayPress: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.two,
  },
  sheetShadow: {
    borderRadius: Radius.xl + 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  sheetClip: {
    borderRadius: Radius.xl + 8,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sheetCard: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    textAlign: 'center',
  },
  confirm: {
    alignSelf: 'stretch',
    marginHorizontal: Spacing.four,
    height: 50,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontWeight: '600',
    fontSize: 16,
  },
});
