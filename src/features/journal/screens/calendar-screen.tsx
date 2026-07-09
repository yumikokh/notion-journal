import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRootNavigationState, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LayoutList, PenLine, RotateCw, SlidersHorizontal } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  TextInput,
  View,
  useColorScheme,
  type ViewToken,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { buildMonthWeeks, type MonthCell } from '@/features/journal/build-month-grid';
import {
  DEFAULT_PREFS,
  MAX_MODES,
  activeViewMode,
  addMode,
  loadCalendarPrefs,
  removeMode,
  renameMode,
  saveCalendarPrefs,
  type CalendarPrefs,
  type CalendarViewMode,
} from '@/features/journal/calendar-prefs';
import { DayDrawer } from '@/features/journal/components/day-drawer';
import {
  MonthSection,
  monthSectionHeight,
} from '@/features/journal/components/month-section';
import { FEELINGS, type Feeling } from '@/features/journal/draft';
import {
  COVER_TOGGLE_ICON,
  DIARY_TOGGLE_ICON,
  habitIcon,
} from '@/features/journal/habit-icons';
import { useMonthEntries } from '@/features/journal/use-month-entries';
import { CaptureSheet } from '@/features/today/components/capture-sheet';
import { useTheme } from '@/hooks/use-theme';
import { toDateKey } from '@/lib/date';
import { isSupabaseEnvConfigured } from '@/lib/env';
import type { MonthEntry, NotionSelectColor } from '@/lib/supabase';

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
/** Liquid glass needs iOS 26+; older systems get solid-color fallbacks. */
const glassOk = isLiquidGlassAvailable();
/** Cell height relative to width — taller than square so photos read well. */
const CELL_HEIGHT_RATIO = 1.4;
/**
 * Vertical space the floating glass chrome (header bar + weekday strip)
 * occupies over the list. The list gets a spacer of this height so content
 * rests below the chrome, then slides beneath it while scrolling — which
 * is what makes the glass actually refract.
 */
const HEADER_BAR_HEIGHT = 36;
const WEEKDAY_STRIP_HEIGHT = 22;
/** Chrome content below the top safe-area inset (the panel bleeds to y=0). */
const CHROME_CONTENT_HEIGHT =
  Spacing.one + HEADER_BAR_HEIGHT + Spacing.one + WEEKDAY_STRIP_HEIGHT + Spacing.two;
/**
 * Skirt below the band where the frosting dissolves: each strip blurs a
 * little less and carries a little less of the background wash.
 */
const SKIRT_STEPS = [
  { intensity: 26, wash: '8C' },
  { intensity: 17, wash: '59' },
  { intensity: 9, wash: '30' },
  { intensity: 4, wash: '12' },
] as const;
const CHROME_SKIRT_HEIGHT = 28;
const FLOATING_CHROME_HEIGHT = CHROME_CONTENT_HEIGHT + Spacing.four;
/** How far the continuous calendar reaches (months before/after today). */
const MONTHS_BACK = 24;
const MONTHS_FORWARD = 1;

type MonthItem = {
  key: string; // YYYY-MM
  year: number;
  month: number; // 0-indexed
  weeks: MonthCell[][];
};

/**
 * Continuous vertically-scrolling calendar: months stack seamlessly in a
 * FlatList (oldest at the top, tomorrow's month at the bottom), opening on
 * the current month. Every month section fetches its own entries lazily as
 * it enters the render window, so scrolling through years stays cheap.
 */
export function CalendarScreen() {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const envOk = isSupabaseEnvConfigured();
  const queryClient = useQueryClient();
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);

  const months = useMemo<MonthItem[]>(() => {
    const list: MonthItem[] = [];
    for (let offset = -MONTHS_BACK; offset <= MONTHS_FORWARD; offset++) {
      const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      list.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        year: d.getFullYear(),
        month: d.getMonth(),
        weeks: buildMonthWeeks(d.getFullYear(), d.getMonth()),
      });
    }
    return list;
  }, [today]);
  const currentMonthIndex = MONTHS_BACK;

  // Cells are sized off the measured list width (screen minus our own
  // horizontal padding). Floor to avoid sub-pixel rounding pushing the
  // 7th column past the container on iOS.
  const [gridWidth, setGridWidth] = useState(0);
  const cellWidth = gridWidth > 0 ? Math.floor(gridWidth / 7) : 0;
  const cellHeight = Math.round(cellWidth * CELL_HEIGHT_RATIO);

  const [prefs, setPrefs] = useState<CalendarPrefs>(DEFAULT_PREFS);
  useEffect(() => {
    loadCalendarPrefs().then(setPrefs);
  }, []);

  // View-mode sheet visibility (switch + customize the display modes).
  // The backdrop fades while the sheet slides — animating the whole Modal
  // with animationType="slide" would make the dim overlay rise with it.
  const [modeSheetOpen, setModeSheetOpen] = useState(false);
  const [sheetAnim] = useState(() => new Animated.Value(0));
  const openModeSheet = useCallback(() => {
    setModeSheetOpen(true);
    Animated.timing(sheetAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [sheetAnim]);
  const closeModeSheet = useCallback(() => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
      setModeSheetOpen(false),
    );
  }, [sheetAnim]);
  const viewMode = activeViewMode(prefs);

  const [drawerDate, setDrawerDate] = useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);

  const insets = useSafeAreaInsets();

  // Header label follows the topmost visible month while scrolling.
  const [visibleIndex, setVisibleIndex] = useState(currentMonthIndex);
  const visibleMonth = months[visibleIndex] ?? months[currentMonthIndex];

  const listRef = useRef<FlatList<MonthItem>>(null);

  /**
   * The current month's entries back the pieces that need a single sample
   * of the user's data (feeling → Notion color map for the day drawer,
   * habit names for the filter chips). The per-month grids fetch their own.
   */
  const currentYearMonth = months[currentMonthIndex].key;
  const currentEntries = useMonthEntries(currentYearMonth, { enabled: envOk });

  const feelingColorMap = useMemo(() => {
    const m: Partial<Record<Feeling, NotionSelectColor | null>> = {};
    currentEntries.data?.forEach((e: MonthEntry) => {
      if (!e.feeling || !FEELINGS.includes(e.feeling as Feeling)) return;
      const key = e.feeling as Feeling;
      if (!(key in m)) m[key] = e.feelingColor;
    });
    return m;
  }, [currentEntries.data]);

  const habitNames = useMemo(() => {
    const seen: string[] = [];
    currentEntries.data?.forEach((e: MonthEntry) => {
      for (const name of Object.keys(e.habits ?? {})) {
        if (!seen.includes(name)) seen.push(name);
      }
    });
    return seen;
  }, [currentEntries.data]);

  const openDay = useCallback((dateKey: string) => {
    setDrawerDate(dateKey);
  }, []);
  const closeDrawer = useCallback(() => setDrawerDate(null), []);

  const scrollToMonth = useCallback(
    (year: number, month: number, animated: boolean) => {
      const key = `${year}-${String(month + 1).padStart(2, '0')}`;
      const index = months.findIndex((m) => m.key === key);
      if (index >= 0) {
        listRef.current?.scrollToIndex({
          index,
          animated,
          viewOffset: FLOATING_CHROME_HEIGHT,
        });
      }
    },
    [months],
  );
  const scrollToToday = useCallback(() => {
    listRef.current?.scrollToIndex({
      index: currentMonthIndex,
      animated: true,
      viewOffset: FLOATING_CHROME_HEIGHT,
    });
  }, [currentMonthIndex]);

  // Jump to the current month once the list has laid out. `initialScrollIndex`
  // can't express the floating-chrome viewOffset, and the `contentOffset`
  // prop is unreliable under FlatList virtualization — an explicit one-shot
  // scroll on layout is.
  const didInitScroll = useRef(false);
  const initialScrollToToday = useCallback(() => {
    if (didInitScroll.current) return;
    didInitScroll.current = true;
    listRef.current?.scrollToIndex({
      index: currentMonthIndex,
      animated: false,
      viewOffset: FLOATING_CHROME_HEIGHT,
    });
  }, [currentMonthIndex]);

  // Deep link from a tapped reminder notification: `/(tabs)?date=YYYY-MM-DD`.
  // The URL is the external system here — when the param changes we mirror
  // it into local state (scroll position + drawer date) and then clear the
  // param so navigating back to the calendar tab doesn't re-trigger it.
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const router = useRouter();
  // A cold-start deep link delivers the param before the root navigator has
  // mounted; touching the router then throws. Wait for the nav-state key.
  const navReady = Boolean(useRootNavigationState()?.key);
  useEffect(() => {
    if (!navReady) return;
    const raw = Array.isArray(params.date) ? params.date[0] : params.date;
    if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return;
    const [yearStr, monthStr] = raw.split('-');
    scrollToMonth(Number(yearStr), Number(monthStr) - 1, false);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing URL param into local UI state on change is exactly the subscription pattern.
    setDrawerDate(raw);
    router.setParams({ date: undefined });
  }, [navReady, params.date, router, scrollToMonth]);

  const updatePrefs = useCallback((mutate: (prev: CalendarPrefs) => CalendarPrefs) => {
    setPrefs((prev) => {
      const next = mutate(prev);
      saveCalendarPrefs(next).catch(() => {});
      return next;
    });
  }, []);

  const setActiveMode = useCallback(
    (index: number) => updatePrefs((prev) => ({ ...prev, activeMode: index })),
    [updatePrefs],
  );
  /** Edit the currently-selected mode's contents (persisted immediately). */
  const updateActiveMode = useCallback(
    (mutate: (mode: CalendarViewMode) => CalendarViewMode) =>
      updatePrefs((prev) => ({
        ...prev,
        modes: prev.modes.map((m, i) => (i === prev.activeMode ? mutate(m) : m)),
      })),
    [updatePrefs],
  );
  const toggleHabitInMode = useCallback(
    (name: string) =>
      updateActiveMode((mode) => {
        // Tapping a single habit while "all" narrows the overlay to just it;
        // otherwise toggle it in the explicit list.
        if (mode.habits === 'all') return { ...mode, habits: [name] };
        return {
          ...mode,
          habits: mode.habits.includes(name)
            ? mode.habits.filter((k) => k !== name)
            : [...mode.habits, name],
        };
      }),
    [updateActiveMode],
  );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Refetch every mounted month at once (each section owns its query).
      await queryClient.invalidateQueries({ queryKey: ['journal', 'month'] });
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  // Precomputed per-month heights let getItemLayout answer synchronously,
  // which the initial contentOffset (jump straight to the current month)
  // requires. Offsets include the chrome spacer (the list's header view
  // that keeps content below the floating glass header at rest).
  const itemLayouts = useMemo(() => {
    let offset = FLOATING_CHROME_HEIGHT;
    return months.map((m) => {
      const length = monthSectionHeight(m.weeks.length, cellHeight);
      const layout = { length, offset };
      offset += length;
      return layout;
    });
  }, [months, cellHeight]);
  const getItemLayout = useCallback(
    (_: ArrayLike<MonthItem> | null | undefined, index: number) => ({
      index,
      ...itemLayouts[index],
    }),
    [itemLayouts],
  );

  // FlatList requires the viewability pairs to keep the same identity across
  // renders — a lazy useState initializer gives us that without touching a
  // ref during render (setVisibleIndex is stable, so the closure stays valid).
  const [viewabilityConfigCallbackPairs] = useState(() => [
    {
      viewabilityConfig: { itemVisiblePercentThreshold: 25 },
      onViewableItemsChanged: ({ viewableItems }: { viewableItems: ViewToken[] }) => {
        const first = viewableItems.find((v) => v.isViewable && typeof v.index === 'number');
        if (first && first.index !== null) setVisibleIndex(first.index);
      },
    },
  ]);

  const renderMonth = useCallback(
    ({ item }: { item: MonthItem }) => (
      <MonthSection
        year={item.year}
        month={item.month}
        weeks={item.weeks}
        cellWidth={cellWidth}
        cellHeight={cellHeight}
        mode={viewMode}
        todayKey={todayKey}
        scheme={scheme}
        enabled={envOk}
        onDayPress={openDay}
      />
    ),
    [cellWidth, cellHeight, viewMode, todayKey, scheme, envOk, openDay],
  );

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View
          style={styles.listContainer}
          onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
          {cellWidth > 0 && (
            <FlatList
              ref={listRef}
              data={months}
              keyExtractor={(m) => m.key}
              renderItem={renderMonth}
              getItemLayout={getItemLayout}
              onLayout={initialScrollToToday}
              viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
              initialNumToRender={3}
              maxToRenderPerBatch={3}
              windowSize={7}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.four }}
              ListHeaderComponent={
                // Rest position for content below the floating glass chrome;
                // scrolling slides months underneath it.
                <View>
                  <View style={{ height: FLOATING_CHROME_HEIGHT }} />
                  {!envOk && (
                    <ThemedText
                      type="small"
                      themeColor="textSecondary"
                      style={styles.statusText}>
                      Notion 未接続
                    </ThemedText>
                  )}
                </View>
              }
              refreshControl={
                envOk ? (
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    progressViewOffset={FLOATING_CHROME_HEIGHT}
                    tintColor={theme.textSecondary}
                  />
                ) : undefined
              }
            />
          )}
        </View>

        {/* Floating chrome: ONE frosted band bleeding edge-to-edge from the
            very top of the screen — a blur with a wash of the background
            color over it, and a gradient skirt below so its lower edge
            melts into the calendar instead of cutting it. */}
        <View style={[styles.chromePanel, { paddingTop: insets.top + Spacing.one }]}>
          <BlurView intensity={36} tint={scheme} style={StyleSheet.absoluteFill} />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: `${theme.background}B3` },
            ]}
          />
          {/* Progressive-blur approximation: stacked strips whose blur
              intensity and color wash both taper off, so the frosting
              itself dissolves instead of a bright gradient shining. */}
          <View style={styles.chromeSkirt} pointerEvents="none">
            {SKIRT_STEPS.map((step, i) => (
              <View key={i} style={styles.chromeSkirtStep}>
                <BlurView
                  intensity={step.intensity}
                  tint={scheme}
                  style={StyleSheet.absoluteFill}
                />
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: `${theme.background}${step.wash}` },
                  ]}
                />
              </View>
            ))}
          </View>
          <View style={styles.chromeHeaderRow}>
            <ThemedText type="subtitle">
              {visibleMonth.year}年{visibleMonth.month + 1}月
            </ThemedText>
            <View style={styles.headerActions}>
              {visibleIndex !== currentMonthIndex && (
                <GlassView
                  glassEffectStyle="regular"
                  isInteractive
                  tintColor={theme.accentSoft}
                  style={[styles.todayGlass, !glassOk && { backgroundColor: theme.accentSoft }]}>
                  <Pressable
                    onPress={scrollToToday}
                    accessibilityRole="button"
                    accessibilityLabel="今日へ移動"
                    style={styles.glassBtnInner}>
                    <ThemedText type="smallBold" style={{ color: theme.accent }}>
                      今日
                    </ThemedText>
                  </Pressable>
                </GlassView>
              )}
              <GlassView
                glassEffectStyle="regular"
                isInteractive
                style={[
                  styles.actionGlass,
                  !glassOk && { backgroundColor: theme.backgroundElement },
                ]}>
                <Pressable
                  onPress={() => router.push('/journal-list')}
                  accessibilityRole="button"
                  accessibilityLabel="日記の一覧"
                  style={styles.glassBtnInner}>
                  <LayoutList size={16} color={theme.textSecondary} strokeWidth={1.8} />
                </Pressable>
              </GlassView>
              <GlassView
                glassEffectStyle="regular"
                isInteractive
                style={[
                  styles.actionGlass,
                  !glassOk && { backgroundColor: theme.backgroundElement },
                ]}>
                <Pressable
                  onPress={openModeSheet}
                  accessibilityRole="button"
                  accessibilityLabel="表示モードを切り替え"
                  style={styles.glassBtnInner}>
                  <SlidersHorizontal size={16} color={theme.textSecondary} strokeWidth={1.8} />
                </Pressable>
              </GlassView>
              <GlassView
                glassEffectStyle="regular"
                isInteractive
                style={[
                  styles.actionGlass,
                  !glassOk && { backgroundColor: theme.backgroundElement },
                ]}>
                <Pressable
                  onPress={onRefresh}
                  disabled={refreshing}
                  accessibilityRole="button"
                  accessibilityLabel="最新のデータに更新"
                  style={styles.glassBtnInner}>
                  {refreshing ? (
                    <ActivityIndicator size="small" color={theme.textSecondary} />
                  ) : (
                    <RotateCw size={16} color={theme.textSecondary} strokeWidth={1.8} />
                  )}
                </Pressable>
              </GlassView>
            </View>
          </View>
          <View style={styles.chromeWeekdayRow}>
            {WEEKDAY_LABELS.map((label, i) => (
              <ThemedText
                key={label}
                type="small"
                themeColor="textSecondary"
                style={[
                  styles.weekdayLabel,
                  i === 0 && { color: theme.holiday },
                  i === 6 && { color: theme.saturday },
                ]}>
                {label}
              </ThemedText>
            ))}
          </View>
        </View>

        {/* Floating pen — the diary tab's quick-capture entry point. The
            calendar snaps to today first so the sheet opens over the day
            it is about to write to. */}
        <Pressable
          onPress={() => {
            scrollToToday();
            setCaptureOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="きろくを書く"
          style={({ pressed }) => [
            styles.fab,
            { bottom: insets.bottom + Spacing.two, opacity: pressed ? 0.85 : 1 },
          ]}>
          <GlassView
            glassEffectStyle="regular"
            isInteractive
            style={[styles.fabGlass, !glassOk && { backgroundColor: theme.accent }]}>
            <PenLine size={24} color={glassOk ? theme.accent : '#ffffff'} strokeWidth={2} />
          </GlassView>
        </Pressable>
      </SafeAreaView>


      {/* View-mode sheet: switching a mode applies immediately, so the
          calendar behind the sheet live-previews the change. */}
      <Modal
        visible={modeSheetOpen}
        transparent
        animationType="none"
        onRequestClose={closeModeSheet}>
        <KeyboardAvoidingView
          style={styles.sheetFlex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheetFlexEnd}>
            <Animated.View style={[styles.sheetBackdrop, { opacity: sheetAnim }]}>
              <Pressable
                style={styles.sheetFlex}
                accessibilityLabel="表示モードの設定を閉じる"
                onPress={closeModeSheet}
              />
            </Animated.View>
            <Animated.View
              style={{
                transform: [
                  {
                    translateY: sheetAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [360, 0],
                    }),
                  },
                ],
              }}>
            <View style={[styles.sheet, { backgroundColor: theme.background }]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                カレンダーの表示モード
              </ThemedText>

              <View style={styles.modeChipRow}>
                {prefs.modes.map((m, i) => {
                  const selected = i === prefs.activeMode;
                  return (
                    <Pressable
                      key={i}
                      onPress={() => setActiveMode(i)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={[
                        styles.modeChip,
                        {
                          backgroundColor: selected
                            ? theme.accentSoft
                            : theme.backgroundElement,
                        },
                      ]}>
                      <ThemedText
                        type="smallBold"
                        style={{ color: selected ? theme.accent : theme.textSecondary }}>
                        {m.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
                {prefs.modes.length < MAX_MODES && (
                  <Pressable
                    onPress={() => updatePrefs(addMode)}
                    accessibilityRole="button"
                    accessibilityLabel="表示モードを追加"
                    style={[styles.modeChip, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      ＋
                    </ThemedText>
                  </Pressable>
                )}
              </View>

            <View style={styles.settingRow}>
              <ThemedText type="small" themeColor="textSecondary">
                モード名
              </ThemedText>
              <TextInput
                value={viewMode.label}
                onChangeText={(text) =>
                  updatePrefs((prev) => renameMode(prev, prev.activeMode, text))
                }
                placeholder="モード名"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.modeNameInput,
                  { color: theme.text, backgroundColor: theme.backgroundElement },
                ]}
              />
            </View>

            <ThemedText type="small" themeColor="textSecondary">
              このモードで表示するもの
            </ThemedText>

            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <COVER_TOGGLE_ICON size={16} color={theme.textSecondary} strokeWidth={1.8} />
                <ThemedText>写真</ThemedText>
              </View>
              <Switch
                value={viewMode.showCover}
                onValueChange={(v) => updateActiveMode((m) => ({ ...m, showCover: v }))}
                trackColor={{ true: theme.accent }}
              />
            </View>
            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <DIARY_TOGGLE_ICON size={16} color={theme.textSecondary} strokeWidth={1.8} />
                <ThemedText>日記テキスト</ThemedText>
              </View>
              <Switch
                value={viewMode.showDiary}
                onValueChange={(v) => updateActiveMode((m) => ({ ...m, showDiary: v }))}
                trackColor={{ true: theme.accent }}
              />
            </View>
            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <ThemedText>気分</ThemedText>
              </View>
              <Switch
                value={viewMode.showMark}
                onValueChange={(v) => updateActiveMode((m) => ({ ...m, showMark: v }))}
                trackColor={{ true: theme.accent }}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingLabel}>
                <ThemedText>習慣</ThemedText>
              </View>
            </View>
            <View style={styles.habitChipRow}>
              <Pressable
                onPress={() =>
                  updateActiveMode((m) => ({ ...m, habits: m.habits === 'all' ? [] : 'all' }))
                }
                accessibilityRole="switch"
                accessibilityState={{ checked: viewMode.habits === 'all' }}
                style={[
                  styles.chipToggle,
                  {
                    backgroundColor:
                      viewMode.habits === 'all' ? theme.accentSoft : theme.backgroundElement,
                  },
                ]}>
                <ThemedText
                  type="small"
                  style={{
                    color: viewMode.habits === 'all' ? theme.accent : theme.textSecondary,
                  }}>
                  すべて
                </ThemedText>
              </Pressable>
              {habitNames.map((name) => {
                const on = viewMode.habits === 'all' || viewMode.habits.includes(name);
                const Icon = habitIcon(name);
                const chipColor = on ? theme.accent : theme.textSecondary;
                return (
                  <Pressable
                    key={name}
                    accessibilityRole="switch"
                    accessibilityLabel={`${name} をカレンダーに表示`}
                    accessibilityState={{ checked: on }}
                    onPress={() => toggleHabitInMode(name)}
                    style={[
                      styles.chipToggle,
                      { backgroundColor: on ? theme.accentSoft : theme.backgroundElement },
                    ]}>
                    <Icon size={14} color={chipColor} strokeWidth={1.8} />
                    <ThemedText type="small" style={{ color: chipColor }}>
                      {name}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            {prefs.modes.length > 1 && (
              <Pressable
                onPress={() => updatePrefs((prev) => removeMode(prev, prev.activeMode))}
                accessibilityRole="button"
                style={styles.deleteModeBtn}>
                <ThemedText type="small" style={{ color: theme.danger }}>
                  このモードを削除
                </ThemedText>
              </Pressable>
            )}
            </View>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <CaptureSheet
        visible={captureOpen}
        onClose={() => setCaptureOpen(false)}
        feelingColors={feelingColorMap}
      />
      <DayDrawer date={drawerDate} onClose={closeDrawer} feelingColors={feelingColorMap} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    // Slimmer than ScreenContainer's default so calendar cells get the width.
    paddingHorizontal: Spacing.two,
  },
  chromePanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.one,
  },
  chromeSkirt: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -CHROME_SKIRT_HEIGHT,
    height: CHROME_SKIRT_HEIGHT,
  },
  chromeSkirtStep: {
    flex: 1,
    overflow: 'hidden',
  },
  chromeHeaderRow: {
    height: HEADER_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chromeWeekdayRow: {
    // Bleed back out so the labels line up with the calendar columns below
    // (grid sits at Spacing.two from the screen edge; panel pads three).
    marginHorizontal: -(Spacing.three - Spacing.two),
    height: WEEKDAY_STRIP_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  todayGlass: {
    height: 32,
    borderRadius: 16,
  },
  actionGlass: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  glassBtnInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two + 2,
  },
  fab: {
    position: 'absolute',
    right: Spacing.four,
  },
  fabGlass: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
  sheetFlex: {
    flex: 1,
  },
  sheetFlexEnd: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  modeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  modeChip: {
    alignItems: 'center',
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    minWidth: 64,
    borderRadius: Radius.lg,
  },
  modeNameInput: {
    minWidth: 160,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.md,
    fontSize: 15,
  },
  deleteModeBtn: {
    alignSelf: 'center',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  habitChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chipToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
  },
});
