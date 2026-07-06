import { ArrowUp, Sparkles, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { buildDayCalendarContext } from '@/features/calendar/calendar-context';
import { useDayEvents } from '@/features/calendar/use-day-events';
import { useTodayEntry } from '@/features/journal/use-today-entry';
import { useAppendLog } from '@/features/today/use-append-log';
import { useSummarizeDay } from '@/features/today/use-summarize-day';
import { formatTimeLabel, parseTodayLogs, type TodayLog } from '@/features/today/today-log';
import { useTheme } from '@/hooks/use-theme';
import { toDateKey } from '@/lib/date';
import { isSupabaseEnvConfigured } from '@/lib/env';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Open the day editor (DayDrawer) for today — owned by the caller. */
  onOpenToday: () => void;
};

/**
 * Quick-capture sheet, opened from the calendar's floating ＋ button.
 *
 * Philosophy: accumulate small fragments through the day with as little
 * friction as possible (FAB → keyboard already up → send), then distill
 * them at night — まとめる runs the AI summary straight into DIARY.
 */
export function QuickCaptureSheet({ visible, onClose, onOpenToday }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      {visible && <SheetContent onClose={onClose} onOpenToday={onOpenToday} />}
    </Modal>
  );
}

function SheetContent({ onClose, onOpenToday }: Pick<Props, 'onClose' | 'onOpenToday'>) {
  const theme = useTheme();
  const envOk = isSupabaseEnvConfigured();

  // Recomputed every render so a sheet left open across midnight targets
  // the new day on the next interaction.
  const today = new Date();
  const todayKey = toDateKey(today);
  const dateLabel = `${today.getMonth() + 1}/${today.getDate()} (${WEEKDAY_LABELS[today.getDay()]})`;

  const entry = useTodayEntry(todayKey, { enabled: envOk });
  const appendLog = useAppendLog(todayKey);
  const logs = useMemo(
    () => parseTodayLogs(entry.data?.bodyMarkdown ?? ''),
    [entry.data?.bodyMarkdown],
  );

  // One-tap まとめる: AI-summarize the accumulated body straight into the
  // DIARY property. Calendar events (when connected) ride along as context.
  const dayEvents = useDayEvents(todayKey);
  const summarize = useSummarizeDay(todayKey);
  const bodyMarkdown = entry.data?.bodyMarkdown ?? '';
  const canSummarize = envOk && bodyMarkdown.trim().length > 0 && !summarize.isPending;
  const runSummarize = useCallback(() => {
    if (!canSummarize) return;
    const start = () =>
      summarize.mutate({
        bodyMarkdown,
        notionPageId: entry.data?.notionPageId ?? null,
        calendarContext: buildDayCalendarContext(dayEvents.data ?? []) || undefined,
      });
    if ((entry.data?.diary ?? '').trim().length > 0) {
      Alert.alert('DIARY を書き直しますか？', '今日の DIARY をAIがまとめ直して上書きします。', [
        { text: 'キャンセル', style: 'cancel' },
        { text: 'まとめ直す', onPress: start },
      ]);
      return;
    }
    start();
  }, [canSummarize, summarize, bodyMarkdown, entry.data, dayEvents.data]);

  const [text, setText] = useState('');
  const listRef = useRef<FlatList<TodayLog>>(null);

  const send = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    appendLog.mutate({ timeLabel: formatTimeLabel(new Date()), text: trimmed });
    setText('');
    // The optimistic update lands synchronously after this tick.
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [text, appendLog]);

  // Inside a pageSheet there is no tab bar; the input only needs the home
  // indicator clearance, and none at all while the keyboard is up.
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
  const inputBarBottom = keyboardShown ? Spacing.two : insets.bottom + Spacing.two;

  const renderLog = useCallback(
    ({ item }: { item: TodayLog }) => (
      <View style={[styles.logCard, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="small" style={{ color: theme.accent }}>
          {item.time}
        </ThemedText>
        <ThemedText selectable style={styles.logText}>
          {item.text}
        </ThemedText>
      </View>
    ),
    [theme],
  );

  const canSend = text.trim().length > 0 && envOk && !appendLog.isPending;

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <View style={styles.headerTitleGroup}>
              <ThemedText type="subtitle">Today</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {dateLabel}
              </ThemedText>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                onPress={runSummarize}
                disabled={!canSummarize}
                accessibilityRole="button"
                accessibilityLabel="今日のログをAIでまとめる"
                style={[
                  styles.summarizeBtn,
                  { backgroundColor: theme.accentSoft, opacity: canSummarize ? 1 : 0.5 },
                ]}>
                {summarize.isPending ? (
                  <ActivityIndicator size="small" color={theme.accent} />
                ) : (
                  <Sparkles size={14} color={theme.accent} strokeWidth={2} />
                )}
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  {summarize.isPending ? 'まとめ中…' : 'まとめる'}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="閉じる"
                hitSlop={8}
                style={[styles.iconBtn, { backgroundColor: theme.backgroundElement }]}>
                <X size={16} color={theme.textSecondary} strokeWidth={2} />
              </Pressable>
            </View>
          </View>

          {summarize.error ? (
            <ThemedText type="small" style={[styles.sendError, { color: theme.danger }]}>
              まとめられませんでした: {summarize.error.message}
            </ThemedText>
          ) : null}

          {(entry.data?.diary ?? '').trim().length > 0 && (
            <Pressable
              onPress={onOpenToday}
              accessibilityRole="button"
              accessibilityLabel="今日のDIARYを開く"
              style={({ pressed }) => [
                styles.diaryCard,
                { backgroundColor: theme.accentSoft, opacity: pressed ? 0.8 : 1 },
              ]}>
              <View style={styles.diaryCardHeader}>
                <Sparkles size={13} color={theme.accent} strokeWidth={2} />
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  今日の DIARY
                </ThemedText>
              </View>
              <ThemedText selectable style={styles.logText}>
                {entry.data?.diary}
              </ThemedText>
            </Pressable>
          )}

          <FlatList
            ref={listRef}
            data={logs}
            keyExtractor={(item, i) => `${item.time}-${i}`}
            renderItem={renderLog}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              !envOk ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  Notion 未接続
                </ThemedText>
              ) : entry.isLoading ? (
                <ActivityIndicator
                  size="small"
                  color={theme.textSecondary}
                  style={styles.emptySpinner}
                />
              ) : (
                <View style={styles.emptyBox}>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                    今日はまだ何もありません。{'\n'}
                    ひとことから、そっと積んでいきましょう。
                  </ThemedText>
                </View>
              )
            }
          />

          {appendLog.error ? (
            <ThemedText type="small" style={[styles.sendError, { color: theme.danger }]}>
              送れませんでした: {appendLog.error.message}
            </ThemedText>
          ) : null}

          <View
            style={[
              styles.inputBar,
              { borderTopColor: theme.backgroundElement, paddingBottom: inputBarBottom },
            ]}>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              autoFocus
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
        </KeyboardAvoidingView>
      </SafeAreaView>
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
    paddingTop: Spacing.three,
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
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diaryCard: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    gap: Spacing.one,
  },
  diaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  summarizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    height: 32,
    borderRadius: Radius.lg,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  logCard: {
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    gap: 2,
  },
  logText: {
    lineHeight: 22,
  },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 22,
  },
  emptySpinner: {
    marginTop: Spacing.five,
  },
  sendError: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.one,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two + 2,
    paddingBottom: Spacing.two + 2,
    fontSize: 16,
    lineHeight: 21,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
