import * as ImagePicker from 'expo-image-picker';
import { ArrowUp, Camera, Check, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import {
  CoverCropModal,
  type CropSource,
} from '@/features/journal/components/cover-crop-modal';
import { DayDrawerContent } from '@/features/journal/components/day-drawer';
import { FeelingPicker } from '@/features/journal/components/feeling-picker';
import { HabitChecks } from '@/features/journal/components/habit-checks';
import type { CropRect } from '@/features/journal/cover-crop';
import { FEELINGS, type Feeling, type HabitKey } from '@/features/journal/draft';
import { useMonthEntries } from '@/features/journal/use-month-entries';
import { useTodayEntry } from '@/features/journal/use-today-entry';
import { useUploadCover } from '@/features/journal/use-upload-cover';
import { formatTimeLabel } from '@/features/today/today-log';
import { useAppendLog } from '@/features/today/use-append-log';
import { toggledHabits, useQuickState } from '@/features/today/use-quick-state';
import { useTheme } from '@/hooks/use-theme';
import { toDateKey } from '@/lib/date';
import { isSupabaseEnvConfigured } from '@/lib/env';
import { invokeNotionTodaySave, type NotionSelectColor } from '@/lib/supabase';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
const EMPTY_HABITS = {
  output: false,
  book: false,
  design: false,
  english: false,
  exercise: false,
} as const;

/** Composer height when the sheet is at rest (content only; insets added). */
const COMPACT_CONTENT_HEIGHT = 330;

type CaptureSheetProps = {
  visible: boolean;
  onClose: () => void;
  feelingColors?: Partial<Record<Feeling, NotionSelectColor | null>>;
};

/**
 * The きろく sheet — a custom JS bottom sheet over the calendar. At rest it
 * is the minimal composer (feeling / habits / cover shortcut / quick log).
 * Dragging the grabber up morphs the SAME sheet into today's full day
 * editor (DayDrawerContent): the container springs to full height while
 * the contents cross-fade, so the transition reads as one surface growing
 * — not two modals swapping. Built in JS because the native formSheet
 * neither reports detent changes nor resizes its content per detent.
 */
export function CaptureSheet({ visible, onClose, feelingColors }: CaptureSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();

  const compactH = COMPACT_CONTENT_HEIGHT + Math.max(insets.bottom, Spacing.three);
  const fullH = screenH - insets.top - Spacing.two;

  const [expanded, setExpanded] = useState(false);
  const [heightAnim] = useState(() => new Animated.Value(compactH));
  const [backdropAnim] = useState(() => new Animated.Value(0));
  const [composerFade] = useState(() => new Animated.Value(1));
  const [drawerFade] = useState(() => new Animated.Value(0));
  // Presentation is hand-animated (slide + backdrop fade in parallel):
  // Modal's own animation fires onShow only after the slide finishes,
  // which made the backdrop appear late.
  const [slideAnim] = useState(() => new Animated.Value(1)); // 1 = offscreen

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: false,
        friction: 11,
        tension: 70,
      }),
    ]).start();
  }, [visible, backdropAnim, slideAnim]);

  const close = useCallback(() => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 160, useNativeDriver: false }),
      Animated.timing(slideAnim, { toValue: 1, duration: 180, useNativeDriver: false }),
      // Shrink while sliding so a fully-expanded sheet also clears the screen.
      Animated.timing(heightAnim, { toValue: compactH, duration: 180, useNativeDriver: false }),
    ]).start(() => {
      onClose();
      // Reset to the composer for the next open — leaving this until here
      // (not on open) is what prevents a one-frame flash of the previous
      // expanded state.
      setExpanded(false);
      heightAnim.setValue(compactH);
      composerFade.setValue(1);
      drawerFade.setValue(0);
    });
  }, [onClose, backdropAnim, slideAnim, heightAnim, composerFade, drawerFade, compactH]);

  const expand = useCallback(() => {
    Keyboard.dismiss();
    setExpanded(true);
    Animated.parallel([
      Animated.spring(heightAnim, {
        toValue: fullH,
        useNativeDriver: false,
        friction: 10,
        tension: 60,
      }),
      Animated.timing(composerFade, { toValue: 0, duration: 160, useNativeDriver: false }),
      Animated.timing(drawerFade, { toValue: 1, duration: 220, useNativeDriver: false }),
    ]).start();
  }, [heightAnim, composerFade, drawerFade, fullH]);

  const collapse = useCallback(() => {
    setExpanded(false);
    Animated.parallel([
      Animated.spring(heightAnim, {
        toValue: compactH,
        useNativeDriver: false,
        friction: 10,
        tension: 60,
      }),
      Animated.timing(composerFade, { toValue: 1, duration: 220, useNativeDriver: false }),
      Animated.timing(drawerFade, { toValue: 0, duration: 160, useNativeDriver: false }),
    ]).start();
  }, [heightAnim, composerFade, drawerFade, compactH]);

  // Grabber drag: follow the finger, then snap to full / compact / closed.
  const live = useRef({ expanded, compactH, fullH, expand, collapse, close, heightAnim });
  useEffect(() => {
    live.current = { expanded, compactH, fullH, expand, collapse, close, heightAnim };
  }, [expanded, compactH, fullH, expand, collapse, close, heightAnim]);
  const [pan, setPan] = useState<ReturnType<typeof PanResponder.create> | null>(null);
  useEffect(() => {
    setPan(
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 8,
        onPanResponderMove: (_e, g) => {
          const s = live.current;
          const base = s.expanded ? s.fullH : s.compactH;
          const next = Math.min(s.fullH, Math.max(120, base - g.dy));
          s.heightAnim.setValue(next);
        },
        onPanResponderRelease: (_e, g) => {
          const s = live.current;
          const base = s.expanded ? s.fullH : s.compactH;
          const current = base - g.dy;
          if (!s.expanded && (g.dy > 90 || g.vy > 1.2)) {
            s.close();
          } else if (current > (s.compactH + s.fullH) / 2) {
            s.expand();
          } else {
            s.collapse();
          }
        },
      }),
    );
  }, []);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <View style={styles.flexEnd}>
        <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
          <Pressable style={styles.flex} accessibilityLabel="きろくを閉じる" onPress={close} />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none">
          <Animated.View
            style={[
              styles.sheet,
              {
                height: heightAnim,
                backgroundColor: theme.background,
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, compactH + 80],
                    }),
                  },
                ],
              },
            ]}>
            <View style={styles.grabberZone} {...(pan?.panHandlers ?? {})}>
              {/* Tap is the discoverable fallback for the drag gesture. */}
              <Pressable
                onPress={() => (expanded ? collapse() : expand())}
                accessibilityRole="button"
                accessibilityLabel={expanded ? 'コンパクトに戻す' : '今日の詳細をひらく'}
                hitSlop={12}
                style={styles.grabberPress}>
                <View style={[styles.grabber, { backgroundColor: theme.backgroundSelected }]} />
              </Pressable>
            </View>
            <Animated.View
              pointerEvents={expanded ? 'none' : 'auto'}
              style={[styles.layer, { opacity: composerFade }]}>
              <Composer feelingColors={feelingColors} onRequestClose={close} />
            </Animated.View>
            <Animated.View
              pointerEvents={expanded ? 'auto' : 'none'}
              style={[styles.layer, { opacity: drawerFade }]}>
              {expanded && (
                <DayDrawerContent
                  date={toDateKey(new Date())}
                  onClose={close}
                  feelingColors={feelingColors}
                />
              )}
            </Animated.View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function Composer({
  feelingColors,
  onRequestClose,
}: {
  feelingColors?: Partial<Record<Feeling, NotionSelectColor | null>>;
  onRequestClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const envOk = isSupabaseEnvConfigured();

  // Recomputed every render so the sheet targets the new day after midnight.
  const today = new Date();
  const todayKey = toDateKey(today);
  const dateLabel = `${today.getMonth() + 1}/${today.getDate()} (${WEEKDAY_LABELS[today.getDay()]})`;

  const entry = useTodayEntry(todayKey, { enabled: envOk });
  const appendLog = useAppendLog(todayKey);
  const quickState = useQuickState(todayKey);
  const uploadCover = useUploadCover();

  // Fall back to colors learned from this month if the caller has none.
  const currentEntries = useMonthEntries(todayKey.slice(0, 7), { enabled: envOk });
  const colorMap = useMemo(() => {
    if (feelingColors) return feelingColors;
    const m: Partial<Record<Feeling, NotionSelectColor | null>> = {};
    currentEntries.data?.forEach((e) => {
      if (!e.feeling || !FEELINGS.includes(e.feeling as Feeling)) return;
      const key = e.feeling as Feeling;
      if (!(key in m)) m[key] = e.feelingColor;
    });
    return m;
  }, [feelingColors, currentEntries.data]);

  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const [lastSent, setLastSent] = useState<{ time: string; text: string } | null>(null);

  // Capture-first: focus once the sheet has settled so the keyboard rides
  // in right after the presentation animation.
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 450);
    return () => clearTimeout(timer);
  }, []);

  const send = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    const timeLabel = formatTimeLabel(new Date());
    appendLog.mutate({ timeLabel, text: trimmed });
    setLastSent({ time: timeLabel, text: trimmed });
    setText('');
  }, [text, appendLog]);

  const setFeeling = useCallback(
    (feeling: Feeling | null) => {
      quickState.setFeeling.mutate({
        feeling,
        notionPageId: entry.data?.notionPageId ?? null,
      });
    },
    [quickState.setFeeling, entry.data?.notionPageId],
  );

  const toggleHabit = useCallback(
    (key: HabitKey) => {
      quickState.toggleHabit.mutate({
        habits: toggledHabits(entry.data?.habits ?? EMPTY_HABITS, key),
        notionPageId: entry.data?.notionPageId ?? null,
      });
    },
    [quickState.toggleHabit, entry.data],
  );

  // Cover photo shortcut: pick → 16:9 crop → (create page if needed) → upload.
  const [cropSource, setCropSource] = useState<CropSource | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const pickCover = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.7,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setCropSource({ uri: asset.uri, width: asset.width, height: asset.height });
  }, []);
  const handleCropConfirm = useCallback(
    async (rect: CropRect) => {
      if (!cropSource) return;
      setCoverBusy(true);
      try {
        const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
        const cropped = await manipulateAsync(cropSource.uri, [{ crop: rect }], {
          compress: 0.8,
          format: SaveFormat.JPEG,
          base64: true,
        });
        if (!cropped.base64) throw new Error('crop produced no data');
        let pageId = entry.data?.notionPageId ?? null;
        if (!pageId) {
          const created = await invokeNotionTodaySave({ notionPageId: null, date: todayKey });
          pageId = created.notionPageId;
        }
        await uploadCover.mutateAsync({
          notionPageId: pageId,
          date: todayKey,
          base64: cropped.base64,
          mimeType: 'image/jpeg',
          filename: 'cover.jpg',
          uri: cropped.uri,
        });
      } finally {
        setCoverBusy(false);
        setCropSource(null);
      }
    },
    [cropSource, entry.data?.notionPageId, todayKey, uploadCover],
  );

  const canSend = text.trim().length > 0 && envOk && !appendLog.isPending;
  const hasCover = Boolean(entry.data?.coverUrl);

  return (
    <View
      style={[styles.composer, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <ThemedText type="subtitle">今日</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {dateLabel}
          </ThemedText>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={pickCover}
            disabled={!envOk || coverBusy}
            accessibilityRole="button"
            accessibilityLabel="今日のカバー写真を選ぶ"
            style={[
              styles.coverBtn,
              { backgroundColor: hasCover ? theme.accentSoft : theme.backgroundElement },
            ]}>
            {coverBusy ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <>
                <Camera
                  size={15}
                  color={hasCover ? theme.accent : theme.textSecondary}
                  strokeWidth={1.8}
                />
                {hasCover && <Check size={13} color={theme.accent} strokeWidth={2.5} />}
              </>
            )}
          </Pressable>
          <Pressable
            onPress={onRequestClose}
            accessibilityRole="button"
            accessibilityLabel="閉じる"
            hitSlop={8}
            style={[styles.closeBtn, { backgroundColor: theme.backgroundElement }]}>
            <X size={16} color={theme.textSecondary} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      <FeelingPicker
        value={(entry.data?.feeling as Feeling | null) ?? null}
        onChange={setFeeling}
        colorMap={colorMap}
      />
      <HabitChecks value={entry.data?.habits ?? EMPTY_HABITS} onToggle={toggleHabit} />

      {/* One fixed-height line keeps the compact sheet height stable; it
          sits next to the input, where the feedback it reports happens. */}
      <View style={styles.feedbackLine}>
        {appendLog.error ? (
          <ThemedText type="small" style={{ color: theme.danger }} numberOfLines={1}>
            送れませんでした: {appendLog.error.message}
          </ThemedText>
        ) : lastSent ? (
          <>
            <Check size={13} color={theme.accent} strokeWidth={2.5} />
            <ThemedText type="small" themeColor="textSecondary">
              {lastSent.time} きろくしました
            </ThemedText>
          </>
        ) : null}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          multiline
          placeholder="今の気持ちを、そのまま。"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />
        <Pressable
          onPress={send}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="ログを送る"
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: canSend ? theme.accent : theme.backgroundSelected,
              opacity: pressed ? 0.7 : 1,
            },
          ]}>
          {appendLog.isPending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <ArrowUp size={18} color="#ffffff" strokeWidth={2.5} />
          )}
        </Pressable>
      </View>

      <CoverCropModal
        source={cropSource}
        busy={coverBusy}
        onCancel={() => setCropSource(null)}
        onConfirm={handleCropConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  flexEnd: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  grabberZone: {
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  grabberPress: {
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.two,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  layer: {
    position: 'absolute',
    top: 26,
    left: 0,
    right: 0,
    bottom: 0,
  },
  composer: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  coverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 32,
    paddingHorizontal: Spacing.three,
    borderRadius: 16,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  feedbackLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    height: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two + 3,
    paddingBottom: Spacing.two + 3,
    fontSize: 16,
    lineHeight: 21,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
