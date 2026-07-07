import { useFocusEffect } from 'expo-router';
import { ArrowUp } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useTodayEntry } from '@/features/journal/use-today-entry';
import { useAppendLog } from '@/features/today/use-append-log';
import { formatTimeLabel, parseTodayLogs, type TodayLog } from '@/features/today/today-log';
import { useTheme } from '@/hooks/use-theme';
import { toDateKey } from '@/lib/date';
import { isSupabaseEnvConfigured } from '@/lib/env';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * The capture tab — lives in the system tab bar's separate trailing circle
 * (`role="search"`), which is how the standard Liquid Glass bar hosts a
 * detached action the way Slack's search does. Opening it focuses the
 * input immediately: a feeling becomes a timestamped log line in the daily
 * page body with no further taps.
 */
export function CaptureScreen() {
  const theme = useTheme();
  const envOk = isSupabaseEnvConfigured();

  // Recomputed every render so the tab targets the new day after midnight.
  const today = new Date();
  const todayKey = toDateKey(today);
  const dateLabel = `${today.getMonth() + 1}/${today.getDate()} (${WEEKDAY_LABELS[today.getDay()]})`;

  const entry = useTodayEntry(todayKey, { enabled: envOk });
  const appendLog = useAppendLog(todayKey);
  const logs = useMemo(
    () => parseTodayLogs(entry.data?.bodyMarkdown ?? ''),
    [entry.data?.bodyMarkdown],
  );

  const [text, setText] = useState('');
  const listRef = useRef<FlatList<TodayLog>>(null);
  const inputRef = useRef<TextInput>(null);

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
    appendLog.mutate({ timeLabel: formatTimeLabel(new Date()), text: trimmed });
    setText('');
    // The optimistic update lands synchronously after this tick.
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [text, appendLog]);

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
  const inputBarBottom = keyboardShown
    ? Spacing.two
    : insets.bottom + BottomTabInset + Spacing.two;

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
      <SafeAreaView style={styles.flex} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <ThemedText type="subtitle">きろく</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {dateLabel}
            </ThemedText>
          </View>

          <FlatList
            ref={listRef}
            data={logs}
            keyExtractor={(item, i) => `${item.time}-${i}`}
            renderItem={renderLog}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            refreshControl={
              envOk ? (
                <RefreshControl
                  refreshing={entry.isRefetching}
                  onRefresh={() => {
                    entry.refetch();
                  }}
                  tintColor={theme.textSecondary}
                />
              ) : undefined
            }
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
    alignItems: 'baseline',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
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
