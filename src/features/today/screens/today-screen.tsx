import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ArrowUp, RotateCw, Settings, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { buildDayCalendarContext } from '@/features/calendar/calendar-context';
import { useDayEvents } from '@/features/calendar/use-day-events';
import { DayDrawer } from '@/features/journal/components/day-drawer';
import { FEELINGS, type Feeling } from '@/features/journal/draft';
import { useMonthEntries } from '@/features/journal/use-month-entries';
import { useTodayEntry } from '@/features/journal/use-today-entry';
import { useAppendLog } from '@/features/today/use-append-log';
import { useSummarizeDay } from '@/features/today/use-summarize-day';
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

  // One-tap まとめる: AI-summarize the accumulated body straight into the
  // DIARY property. Calendar events (when connected) ride along as context.
  const router = useRouter();
  const queryClient = useQueryClient();
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

  // Explicit refresh: today's entry + this month (feeds the DIARY card,
  // timeline, and the calendar behind it).
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['journal', 'today', todayKey] }),
        queryClient.invalidateQueries({ queryKey: ['journal', 'month', todayKey.slice(0, 7)] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, todayKey]);

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
              <ThemedText type="subtitle">Today</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {dateLabel}
              </ThemedText>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                onPress={refresh}
                disabled={refreshing}
                accessibilityRole="button"
                accessibilityLabel="最新のデータに更新"
                style={[styles.iconBtn, { backgroundColor: theme.backgroundElement }]}>
                {refreshing ? (
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                ) : (
                  <RotateCw size={16} color={theme.textSecondary} strokeWidth={1.8} />
                )}
              </Pressable>
              <Pressable
                onPress={() => router.push('/settings')}
                accessibilityRole="button"
                accessibilityLabel="設定"
                style={[styles.iconBtn, { backgroundColor: theme.backgroundElement }]}>
                <Settings size={16} color={theme.textSecondary} strokeWidth={1.8} />
              </Pressable>
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
            </View>
          </View>

          {summarize.error ? (
            <ThemedText type="small" style={[styles.sendError, { color: theme.danger }]}>
              まとめられませんでした: {summarize.error.message}
            </ThemedText>
          ) : null}

          {(entry.data?.diary ?? '').trim().length > 0 && (
            <Pressable
              onPress={() => setDrawerDate(todayKey)}
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
            refreshControl={
              envOk ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={refresh}
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
