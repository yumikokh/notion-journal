import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ArrowUp, Camera, Check, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import {
  CoverCropModal,
  type CropSource,
} from '@/features/journal/components/cover-crop-modal';
import { FeelingPicker } from '@/features/journal/components/feeling-picker';
import { HabitChecks } from '@/features/journal/components/habit-checks';
import type { CropRect } from '@/features/journal/cover-crop';
import { FEELINGS, type Feeling, type HabitKey } from '@/features/journal/draft';
import { useMonthEntries } from '@/features/journal/use-month-entries';
import { useTodayEntry } from '@/features/journal/use-today-entry';
import { useUploadCover } from '@/features/journal/use-upload-cover';
import { useAppendLog } from '@/features/today/use-append-log';
import { useQuickState, toggledHabits } from '@/features/today/use-quick-state';
import { formatTimeLabel } from '@/features/today/today-log';
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

/**
 * The きろく surface — the system tab bar's detached circle (role="search").
 *
 * Deliberately NOT a journal view: no timeline, no past entries. Just the
 * "today inputs" that fit one tap each — a feeling, habit checks, a cover
 * photo — around the timestamped quick-log input, which focuses the moment
 * the tab opens. Anything deeper (DIARY, body, AI) lives in the day drawer
 * on the calendar.
 */
export function CaptureScreen() {
  const theme = useTheme();
  const router = useRouter();
  const envOk = isSupabaseEnvConfigured();

  // Recomputed every render so the tab targets the new day after midnight.
  const today = new Date();
  const todayKey = toDateKey(today);
  const dateLabel = `${today.getMonth() + 1}/${today.getDate()} (${WEEKDAY_LABELS[today.getDay()]})`;

  const entry = useTodayEntry(todayKey, { enabled: envOk });
  const appendLog = useAppendLog(todayKey);
  const quickState = useQuickState(todayKey);
  const uploadCover = useUploadCover();

  // Feeling colors learned from this month's entries (same as the drawer).
  const currentEntries = useMonthEntries(todayKey.slice(0, 7), { enabled: envOk });
  const feelingColorMap = useMemo(() => {
    const m: Partial<Record<Feeling, NotionSelectColor | null>> = {};
    currentEntries.data?.forEach((e) => {
      if (!e.feeling || !FEELINGS.includes(e.feeling as Feeling)) return;
      const key = e.feeling as Feeling;
      if (!(key in m)) m[key] = e.feelingColor;
    });
    return m;
  }, [currentEntries.data]);

  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);
  const [lastSent, setLastSent] = useState<{ time: string; text: string } | null>(null);

  // Capture-first: focus the input every time the tab opens (after the tab
  // switch animation, so the keyboard doesn't fight the transition).
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }, []),
  );

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

  // The floating native tab bar overlays content; clear it while the
  // keyboard is down, hug the keyboard while it's up.
  const insets = useSafeAreaInsets();
  const [keyboardShown, setKeyboardShown] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => setKeyboardShown(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardShown(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const clusterBottom = keyboardShown
    ? Spacing.two
    : insets.bottom + BottomTabInset + Spacing.two;

  const canSend = text.trim().length > 0 && envOk && !appendLog.isPending;
  const hasCover = Boolean(entry.data?.coverUrl);

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <View style={styles.headerTitleGroup}>
              <ThemedText type="subtitle">きろく</ThemedText>
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
                onPress={() => {
                  Keyboard.dismiss();
                  // Return to wherever the user came from (tab history),
                  // falling back to the diary tab.
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.navigate('/');
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel="閉じる"
                hitSlop={8}
                style={[styles.closeBtn, { backgroundColor: theme.backgroundElement }]}>
                <X size={16} color={theme.textSecondary} strokeWidth={2} />
              </Pressable>
            </View>
          </View>

          {/* Quiet middle: only the last capture's confirmation lives here —
              no timeline, this is a place to write, not to read. */}
          <View style={styles.feedbackArea}>
            {appendLog.error ? (
              <ThemedText type="small" style={{ color: theme.danger }} selectable>
                送れませんでした: {appendLog.error.message}
              </ThemedText>
            ) : lastSent ? (
              <View style={styles.sentRow}>
                <Check size={14} color={theme.accent} strokeWidth={2.5} />
                <ThemedText type="small" themeColor="textSecondary">
                  {lastSent.time} きろくしました
                </ThemedText>
              </View>
            ) : (
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyHint}>
                いまの気持ちを、そのまま。
              </ThemedText>
            )}
          </View>

          <View style={[styles.cluster, { paddingBottom: clusterBottom }]}>
            <FeelingPicker
              value={(entry.data?.feeling as Feeling | null) ?? null}
              onChange={setFeeling}
              colorMap={feelingColorMap}
            />
            <HabitChecks
              value={entry.data?.habits ?? EMPTY_HABITS}
              onToggle={toggleHabit}
            />
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={setText}
                multiline
                placeholder="いま、なにしてる？"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.backgroundElement },
                ]}
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
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <CoverCropModal
        source={cropSource}
        busy={coverBusy}
        onCancel={() => setCropSource(null)}
        onConfirm={handleCropConfirm}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
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
  feedbackArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  sentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  emptyHint: {
    textAlign: 'center',
  },
  cluster: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
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
