import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { computeCropRect, coverBaseScale, type CropRect } from '@/features/journal/cover-crop';
import { useTheme } from '@/hooks/use-theme';

const MAX_ZOOM = 5;
/** Covers render 16:9 in the day drawer — crop to the same shape. */
const CROP_ASPECT = 16 / 9;

export type CropSource = {
  uri: string;
  width: number;
  height: number;
};

type Props = {
  /** Image awaiting a crop; `null` hides the modal. */
  source: CropSource | null;
  /** True while the caller is rendering the cropped image. */
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (rect: CropRect) => void;
};

/**
 * Fixed 16:9 cover cropper: the crop frame is a ScrollView viewport and the
 * photo (rendered at cover-fit for zoom 1) pans/pinches natively inside it.
 * The visible viewport maps back to source pixels via `computeCropRect`.
 */
export function CoverCropModal({ source, busy = false, onCancel, onConfirm }: Props) {
  return (
    <Modal
      visible={source !== null}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}>
      {source && (
        <CropContent source={source} busy={busy} onCancel={onCancel} onConfirm={onConfirm} />
      )}
    </Modal>
  );
}

function CropContent({ source, busy, onCancel, onConfirm }: Props & { source: CropSource }) {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();

  const frameWidth = windowWidth - Spacing.four * 2;
  const frameHeight = Math.round(frameWidth / CROP_ASPECT);

  // Image size in display points at zoom 1 (cover fit — no letterboxing,
  // so every scroll/zoom position is a valid full-bleed crop).
  const displaySize = useMemo(() => {
    const scale = coverBaseScale(source.width, source.height, frameWidth, frameHeight);
    return { width: source.width * scale, height: source.height * scale };
  }, [source, frameWidth, frameHeight]);

  // Track the viewport imperatively — re-rendering on every scroll frame
  // would fight the native pan/zoom.
  const viewportRef = useRef({ zoomScale: 1, offsetX: 0, offsetY: 0 });
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    viewportRef.current = {
      zoomScale: e.nativeEvent.zoomScale,
      offsetX: e.nativeEvent.contentOffset.x,
      offsetY: e.nativeEvent.contentOffset.y,
    };
  };

  const [confirmed, setConfirmed] = useState(false);
  const handleConfirm = () => {
    if (confirmed || busy) return;
    setConfirmed(true);
    onConfirm(
      computeCropRect({
        imageWidth: source.width,
        imageHeight: source.height,
        frameWidth,
        frameHeight,
        ...viewportRef.current,
      }),
    );
  };

  const working = busy || confirmed;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="smallBold" style={styles.title}>
          カバーにする範囲を選ぶ
        </ThemedText>
        <ThemedText type="small" style={styles.hint}>
          ドラッグとピンチで調整できます（16:9）
        </ThemedText>

        <View style={styles.frameWrap}>
          <View style={[styles.frame, { width: frameWidth, height: frameHeight }]}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={displaySize}
              minimumZoomScale={1}
              maximumZoomScale={MAX_ZOOM}
              bouncesZoom
              bounces={false}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={16}
              // Both axes scroll freely inside the fixed viewport.
              directionalLockEnabled={false}>
              <Image
                source={{ uri: source.uri }}
                style={{ width: displaySize.width, height: displaySize.height }}
              />
            </ScrollView>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={onCancel}
            disabled={working}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cancelBtn, { opacity: pressed ? 0.6 : 1 }]}>
            <ThemedText style={styles.cancelText}>キャンセル</ThemedText>
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            disabled={working}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.confirmBtn,
              { backgroundColor: theme.accent, opacity: pressed || working ? 0.7 : 1 },
            ]}>
            {working ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <ThemedText style={styles.confirmText}>この範囲にする</ThemedText>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // The cropper reads best on a dark stage regardless of theme.
    backgroundColor: '#111111',
  },
  safeArea: {
    flex: 1,
  },
  title: {
    color: '#ffffff',
    textAlign: 'center',
    marginTop: Spacing.three,
  },
  hint: {
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: Spacing.one,
  },
  frameWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  scroll: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  cancelBtn: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  cancelText: {
    color: 'rgba(255,255,255,0.8)',
  },
  confirmBtn: {
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.xl,
    minWidth: 160,
    alignItems: 'center',
  },
  confirmText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
