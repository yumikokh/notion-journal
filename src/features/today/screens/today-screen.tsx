import { ArrowUp, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { DayDrawer } from '@/features/journal/components/day-drawer';
import { FEELINGS, type Feeling } from '@/features/journal/draft';
import { useMonthEntries } from '@/features/journal/use-month-entries';
import { useTodayEntry } from '@/features/journal/use-today-entry';
import { useAppendLog } from '@/features/today/use-append-log';
import { formatTimeLabel, parseTodayLogs, type TodayLog } from '@/features/today/today-log';
import { useTheme } from '@/hooks/use-theme';
import { toDateKey } from '@/lib/date';
import { isSupabaseEnvConfigured } from '@/lib/env';
import type { NotionSelectColor } from '@/lib/supabase';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * きょう (Today) tab — the app's capture surface.
 *
 * Philosophy: accumulate small fragments through the day with as little
 * friction as possible (one input bar, one tap to send), then distill them
 * at night — the ✨まとめる button opens the day drawer where the existing
 * AI summary (body → DIARY) lives. Reading back happens in the 日記 tab.
 */
export function TodayScreen() {
  const theme = useTheme();
  const envOk = isSupabaseEnvConfigured();

  // Recomputed every render so the screen rolls over at midnight without a
  // restart (any state change after 0:00 re-targets the new day).
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

  // The floating native tab bar overlays content, so the input bar needs
  // clearance for it (+ home indicator) — except while the keyboard is up,
  // when the tab bar is hidden behind it and the clearance would read as a
  // dead gap above the keyboard.
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

  const send = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    appendLog.mutate({ timeLabel: formatTimeLabel(new Date()), text: trimmed });
    setText('');
    // The optimistic update lands synchronously after this tick.
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [text, appendLog]);

  // DayDrawer for the「まとめる」flow; feeling colors ride on the month
  // cache the calendar already maintains.
  const [drawerDate, setDrawerDate] = useState<string | null>(null);
  const currentYearMonth = todayKey.slice(0, 7);
  const monthEntries = useMonthEntries(currentYearMonth, { enabled: envOk });
  const feelingColorMap = useMemo(() => {
    const map: Partial<Record<Feeling, NotionSelectColor | null>> = {};
    monthEntries.data?.forEach((e) => {
      if (!e.feeling || !FEELINGS.includes(e.feeling as Feeling)) return;
      const key = e.feeling as Feeling;
      if (!(key in map)) map[key] = e.feelingColor;
    });
    return map;
  }, [monthEntries.data]);

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
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}>
          <View style={styles.header}>
            <View style={styles.headerTitleGroup}>
              <ThemedText type="subtitle">today</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {dateLabel}
              </ThemedText>
            </View>
            <Pressable
              onPress={() => setDrawerDate(todayKey)}
              accessibilityRole="button"
              accessibilityLabel="今日をまとめる"
              style={[styles.summarizeBtn, { backgroundColor: theme.accentSoft }]}>
              <Sparkles size={14} color={theme.accent} strokeWidth={2} />
              <ThemedText type="smallBold" style={{ color: theme.accent }}>
                まとめる
              </ThemedText>
            </Pressable>
          </View>

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
      <DayDrawer
        date={drawerDate}
        onClose={() => setDrawerDate(null)}
        feelingColors={feelingColorMap}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
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
