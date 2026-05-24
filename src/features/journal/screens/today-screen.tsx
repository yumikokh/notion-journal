/* eslint-disable react-hooks/immutability */
// Reanimated `sharedValue.value = ...` writes inside gesture handlers are
// the canonical API; shared values are not React state.

import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { MarkdownView } from '@/components/markdown-view';
import { ScreenContainer } from '@/components/screen-container';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { FeelingPicker } from '@/features/journal/components/feeling-picker';
import { HabitChecks } from '@/features/journal/components/habit-checks';
import {
  draftReducer,
  draftToSnapshot,
  EMPTY_DRAFT,
  HABITS,
  type UserDraftAction,
} from '@/features/journal/draft';
import { useAiStructure } from '@/features/journal/use-ai-structure';
import { useSaveAll } from '@/features/journal/use-save-today';
import { useTodayEntry } from '@/features/journal/use-today-entry';
import { useUploadCover } from '@/features/journal/use-upload-cover';
import { emptySnapshot } from '@/features/notion/mapping';
import { notionChipColor } from '@/features/notion/colors';
import type { TodayEntrySnapshot } from '@/features/notion/types';
import { loadCustomPrompt } from '@/features/settings/prompt-storage';
import { useTheme } from '@/hooks/use-theme';
import { addDays, formatJournalTitle, toDateKey } from '@/lib/date';
import { isSupabaseEnvConfigured } from '@/lib/env';

type PendingPhoto = {
  uri: string;
  base64: string;
  mimeType: string;
  filename?: string;
};

const SWIPE_DISMISS_RATIO = 0.25;
const SWIPE_DISMISS_VELOCITY = 500;
const TRANSITION_MS = 180;

/**
 * Journal screen.
 *
 * Same UI handles **今日** (no `?date` param) and arbitrary past days
 * (`/day/[date]`). View mode is read-only; `✎ 編集` switches to edit and
 * `💾 保存` writes properties + body + (any pending cover photo). Header
 * `‹ / ›` step day-by-day; horizontal swipe also pages. A `⏎ 今日へ`
 * shortcut appears when the displayed day is not today.
 */
export function TodayScreen() {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const envOk = isSupabaseEnvConfigured();

  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const rawDate = Array.isArray(params.date) ? params.date[0] : params.date;
  const onDayRoute = Boolean(rawDate); // `/day/[date]` vs the today tab

  // `today` is captured once on mount so the date doesn't shift mid-edit.
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);

  // Active date — from the route param when valid, else today.
  const dateKey = useMemo(() => {
    if (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;
    return todayKey;
  }, [rawDate, todayKey]);
  const dateObj = useMemo(() => new Date(`${dateKey}T00:00:00`), [dateKey]);
  const isToday = dateKey === todayKey;

  const { width } = useWindowDimensions();

  const entry = useTodayEntry(dateKey, { enabled: envOk });
  const saveAll = useSaveAll();
  const uploadCover = useUploadCover();
  const ai = useAiStructure();

  const [draft, dispatch] = useReducer(draftReducer, EMPTY_DRAFT);
  const initializedRef = useRef(false);
  const lastDateRef = useRef(dateKey);
  const [lastSyncedBody, setLastSyncedBody] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null);
  const [conflict, setConflict] = useState<{
    serverBody: string;
    freshSnapshot: TodayEntrySnapshot;
  } | null>(null);

  // Reset local state whenever the active date changes (swipe / nav buttons).
  useEffect(() => {
    if (lastDateRef.current !== dateKey) {
      lastDateRef.current = dateKey;
      initializedRef.current = false;
      setLastSyncedBody(null);
      setMode('view');
      setPendingPhoto(null);
      setConflict(null);
      dispatch({ type: 'init', from: emptySnapshot(dateKey) });
    }
  }, [dateKey]);

  useEffect(() => {
    if (entry.data && !initializedRef.current) {
      dispatch({ type: 'init', from: entry.data });
      setLastSyncedBody(entry.data.bodyMarkdown);
      initializedRef.current = true;
    }
  }, [entry.data]);

  const onAction = useCallback((action: UserDraftAction) => {
    dispatch(action);
  }, []);

  const baseSnap = entry.data ?? emptySnapshot(dateKey);

  const isDirty = useMemo(() => {
    if (pendingPhoto) return true;
    if (!entry.data) {
      if (draft.freeText.trim().length > 0) return true;
      if (draft.feeling) return true;
      if (draft.diary.trim().length > 0) return true;
      for (const { key } of HABITS) if (draft.habits[key]) return true;
      return false;
    }
    const snap = entry.data;
    if (draft.freeText !== (lastSyncedBody ?? snap.bodyMarkdown)) return true;
    if (draft.feeling !== snap.feeling) return true;
    if (draft.diary !== snap.diary) return true;
    for (const { key } of HABITS) {
      if (draft.habits[key] !== snap.habits[key]) return true;
    }
    return false;
  }, [draft, entry.data, lastSyncedBody, pendingPhoto]);

  const isSaving = saveAll.isPending || uploadCover.isPending;

  const doSave = useCallback(async () => {
    // 1. Save properties + body. If page doesn't exist yet, this creates it.
    // Pass `lastSyncedBody` so the Edge Function can use Notion's
    // targeted `update_content` mode and preserve non-text blocks
    // (images, embeds, …) the user didn't touch.
    const snap = draftToSnapshot(draft, baseSnap);
    const saved = await saveAll.mutateAsync({ snapshot: snap, lastSyncedBody });
    setLastSyncedBody(saved.bodyMarkdown);

    // 2. If a photo is pending, upload it to set the cover.
    if (pendingPhoto && saved.notionPageId) {
      await uploadCover.mutateAsync({
        notionPageId: saved.notionPageId,
        date: saved.date,
        base64: pendingPhoto.base64,
        mimeType: pendingPhoto.mimeType,
        filename: pendingPhoto.filename,
      });
      setPendingPhoto(null);
    }

    setMode('view');
  }, [draft, baseSnap, saveAll, uploadCover, pendingPhoto, lastSyncedBody]);

  const handleSave = async () => {
    if (!envOk || !isDirty) return;
    const fresh = await entry.refetch();
    const serverBody = fresh.data?.bodyMarkdown ?? '';
    if (lastSyncedBody !== null && serverBody !== lastSyncedBody && fresh.data) {
      setConflict({ serverBody, freshSnapshot: fresh.data });
    } else {
      await doSave();
    }
  };

  const handleEnterEdit = () => setMode('edit');

  /**
   * Force a re-fetch from Notion and re-seed the local draft.
   * Only exposed in view mode so it can't silently discard in-progress edits.
   */
  const handleRefresh = async () => {
    const result = await entry.refetch();
    if (result.data) {
      dispatch({ type: 'init', from: result.data });
      setLastSyncedBody(result.data.bodyMarkdown);
    }
  };

  const handleCancel = () => {
    const source = entry.data ?? emptySnapshot(dateKey);
    dispatch({ type: 'init', from: source });
    setLastSyncedBody(source.bodyMarkdown);
    setPendingPhoto(null);
    setMode('view');
  };

  const acceptServer = () => {
    if (!conflict) return;
    dispatch({ type: 'init', from: conflict.freshSnapshot });
    setLastSyncedBody(conflict.serverBody);
    setConflict(null);
    setMode('view');
  };

  const overwriteServer = async () => {
    setConflict(null);
    await doSave();
  };

  const handleAi = async () => {
    if (!envOk || draft.freeText.trim().length === 0 || ai.isPending) return;
    const customPrompt = await loadCustomPrompt();
    ai.mutate(
      { bodyText: draft.freeText, systemPrompt: customPrompt ?? undefined },
      {
        onSuccess: (output) => dispatch({ type: 'apply-ai', diary: output.diary }),
      },
    );
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.7,
      base64: true,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) return;
    setPendingPhoto({
      uri: asset.uri,
      base64: asset.base64,
      mimeType: asset.mimeType ?? 'image/jpeg',
      filename: asset.fileName ?? undefined,
    });
  };

  const canStructure = draft.freeText.trim().length > 0 && !ai.isPending && envOk;
  const checkedHabits = HABITS.filter(({ key }) => draft.habits[key]);
  const displayCoverUri = pendingPhoto?.uri ?? entry.data?.coverUrl ?? null;
  const chip = entry.data?.feeling
    ? notionChipColor(entry.data.feelingColor, scheme)
    : null;
  const pageIcon = entry.data?.icon;

  /**
   * Date navigation:
   *  - From today tab → push `/day/[date]` so back-swipe returns home.
   *  - From `/day/[date]` → swap with `replace` to keep the stack flat.
   *  - "今日へ" replaces with the today tab route, which both unwinds the
   *    day stack and ensures we land on the today tab.
   */
  const navigateToDate = useCallback(
    (nextKey: string) => {
      if (nextKey === dateKey) return;
      if (nextKey === todayKey) {
        router.replace('/');
        return;
      }
      if (onDayRoute) {
        router.replace({ pathname: '/day/[date]', params: { date: nextKey } });
      } else {
        router.push({ pathname: '/day/[date]', params: { date: nextKey } });
      }
    },
    [dateKey, onDayRoute, todayKey],
  );

  const goPrev = useCallback(() => {
    navigateToDate(toDateKey(addDays(dateObj, -1)));
  }, [dateObj, navigateToDate]);
  const goNext = useCallback(() => {
    // Block forward navigation past today: future days have no entries
    // and aren't editable in this UI.
    if (isToday) return;
    navigateToDate(toDateKey(addDays(dateObj, 1)));
  }, [dateObj, isToday, navigateToDate]);
  const goToday = useCallback(() => {
    navigateToDate(todayKey);
  }, [navigateToDate, todayKey]);

  // Horizontal swipe → previous/next day. Blocked while editing so it
  // can't fight a TextInput selection drag.
  const translateX = useSharedValue(0);
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(mode === 'view')
        .activeOffsetX([-15, 15])
        .failOffsetY([-20, 20])
        .onChange((e) => {
          translateX.value = e.translationX;
        })
        .onEnd((e) => {
          const threshold = width * SWIPE_DISMISS_RATIO;
          const fast = Math.abs(e.velocityX) > SWIPE_DISMISS_VELOCITY;
          // Swipe left = "advance to next day". Blocked when already on today.
          if ((e.translationX < -threshold || (fast && e.velocityX < 0)) && !isToday) {
            translateX.value = withTiming(-width, { duration: TRANSITION_MS }, () => {
              runOnJS(goNext)();
              translateX.value = 0;
            });
          } else if (e.translationX > threshold || (fast && e.velocityX > 0)) {
            translateX.value = withTiming(width, { duration: TRANSITION_MS }, () => {
              runOnJS(goPrev)();
              translateX.value = 0;
            });
          } else {
            translateX.value = withTiming(0, { duration: 150 });
          }
        }),
    [goNext, goPrev, isToday, mode, translateX, width],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.flex, animatedStyle]}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.dateNav}>
                <Pressable
                  onPress={goPrev}
                  accessibilityLabel="前の日"
                  hitSlop={8}
                  style={styles.dateNavBtn}>
                  <ThemedText type="subtitle">‹</ThemedText>
                </Pressable>
                <View style={styles.dateTitleWrap}>
                  {pageIcon?.type === 'emoji' && (
                    <ThemedText style={styles.dateIcon}>{pageIcon.emoji}</ThemedText>
                  )}
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatJournalTitle(dateObj)}
                  </ThemedText>
                </View>
                {isToday ? (
                  // 未来日への遷移は不要 — keep the slot to preserve layout.
                  <View style={styles.dateNavBtn} />
                ) : (
                  <Pressable
                    onPress={goNext}
                    accessibilityLabel="次の日"
                    hitSlop={8}
                    style={styles.dateNavBtn}>
                    <ThemedText type="subtitle">›</ThemedText>
                  </Pressable>
                )}
              </View>
              <StatusPill
                envOk={envOk}
                entry={entry}
                save={saveAll}
                uploading={uploadCover.isPending}
              />
            </View>
            <View style={styles.headerActions}>
              <View style={styles.headerActionsLeft}>
                {!isToday && (
                  <Pressable
                    onPress={goToday}
                    accessibilityRole="button"
                    accessibilityLabel="今日へ"
                    style={[styles.headerBtn, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="smallBold">⏎ 今日へ</ThemedText>
                  </Pressable>
                )}
              </View>
              {mode === 'view' ? (
                <View style={styles.editActions}>
                  <Pressable
                    onPress={handleRefresh}
                    disabled={entry.isFetching}
                    accessibilityRole="button"
                    accessibilityLabel="Notion から再読み込み"
                    style={[
                      styles.headerBtn,
                      {
                        backgroundColor: theme.backgroundElement,
                        opacity: entry.isFetching ? 0.5 : 1,
                      },
                    ]}>
                    <ThemedText type="smallBold">
                      {entry.isFetching ? '更新中…' : '🔄 更新'}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={handleEnterEdit}
                    accessibilityRole="button"
                    style={[styles.headerBtn, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="smallBold">✎ 編集</ThemedText>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.editActions}>
                  <Pressable
                    onPress={handleCancel}
                    accessibilityRole="button"
                    disabled={isSaving}
                    style={[styles.headerBtn, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      キャンセル
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={handleSave}
                    disabled={!isDirty || isSaving}
                    accessibilityRole="button"
                    style={[
                      styles.headerBtn,
                      {
                        backgroundColor: isDirty ? theme.text : theme.backgroundElement,
                        opacity: isDirty && !isSaving ? 1 : 0.5,
                      },
                    ]}>
                    <ThemedText
                      type="smallBold"
                      style={{ color: isDirty ? theme.background : theme.textSecondary }}>
                      {isSaving ? '保存中…' : '💾 保存'}
                    </ThemedText>
                  </Pressable>
                </View>
              )}
            </View>
          </View>

          {(entry.error || saveAll.error || ai.error || uploadCover.error) && (
            <View style={[styles.errorBanner, { backgroundColor: theme.backgroundElement }]}>
              {entry.error && (
                <ThemedText type="small" style={styles.errorText}>
                  📥 読み込み: {entry.error.message}
                </ThemedText>
              )}
              {saveAll.error && (
                <ThemedText type="small" style={styles.errorText}>
                  💾 保存: {saveAll.error.message}
                </ThemedText>
              )}
              {uploadCover.error && (
                <ThemedText type="small" style={styles.errorText}>
                  🖼️ カバー: {uploadCover.error.message}
                </ThemedText>
              )}
              {ai.error && (
                <ThemedText type="small" style={styles.errorText}>
                  ✨ AI: {ai.error.message}
                </ThemedText>
              )}
            </View>
          )}

          {/* Cover photo */}
          <View style={styles.section}>
            <View style={styles.coverHeader}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                カバー写真
              </ThemedText>
              {mode === 'edit' && (
                <Pressable
                  onPress={pickPhoto}
                  accessibilityRole="button"
                  disabled={isSaving}
                  style={[styles.coverBtn, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold">
                    {displayCoverUri ? '📷 変更' : '📷 選ぶ'}
                  </ThemedText>
                </Pressable>
              )}
            </View>
            {displayCoverUri ? (
              <View style={styles.coverWrap}>
                <Image source={{ uri: displayCoverUri }} style={styles.coverImage} />
                {pendingPhoto && (
                  <View style={[styles.coverPendingBadge, { backgroundColor: theme.backgroundSelected }]}>
                    <ThemedText type="small" themeColor="textSecondary">
                      保存待ち
                    </ThemedText>
                  </View>
                )}
              </View>
            ) : (
              <View style={[styles.viewBlock, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="default" themeColor="textSecondary">
                  (未設定)
                </ThemedText>
              </View>
            )}
          </View>

          {/* Body */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              本文
            </ThemedText>
            {mode === 'view' ? (
              <View style={[styles.viewBlock, { backgroundColor: theme.backgroundElement }]}>
                {draft.freeText.trim() ? (
                  <MarkdownView>{draft.freeText}</MarkdownView>
                ) : (
                  <ThemedText type="default" themeColor="textSecondary">
                    (未記入)
                  </ThemedText>
                )}
              </View>
            ) : (
              <>
                <TextInput
                  multiline
                  textAlignVertical="top"
                  value={draft.freeText}
                  onChangeText={(value) => onAction({ type: 'set-free-text', value })}
                  placeholder="今日あったこと、感じたことを自由に書く…"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.freeText,
                    { color: theme.text, backgroundColor: theme.backgroundElement },
                  ]}
                />
                <Pressable
                  onPress={handleAi}
                  disabled={!canStructure}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canStructure, busy: ai.isPending }}
                  style={[
                    styles.aiBtn,
                    {
                      backgroundColor: canStructure
                        ? theme.backgroundSelected
                        : theme.backgroundElement,
                      opacity: canStructure ? 1 : 0.5,
                    },
                  ]}>
                  <ThemedText
                    type="smallBold"
                    themeColor={canStructure ? 'text' : 'textSecondary'}>
                    {ai.isPending ? '整理中…' : '✨ AI で整理'}
                  </ThemedText>
                </Pressable>
              </>
            )}
          </View>

          {/* Feeling */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              気分
            </ThemedText>
            {mode === 'view' ? (
              draft.feeling && chip ? (
                <View style={[styles.feelingChip, { backgroundColor: chip.background }]}>
                  <ThemedText
                    type="default"
                    style={{ color: chip.text, fontWeight: '600' }}>
                    {draft.feeling}
                  </ThemedText>
                </View>
              ) : (
                <View style={[styles.viewBlock, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="default" themeColor="textSecondary">
                    (未選択)
                  </ThemedText>
                </View>
              )
            ) : (
              <FeelingPicker
                value={draft.feeling}
                onChange={(value) => onAction({ type: 'set-feeling', value })}
              />
            )}
          </View>

          {/* Diary */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              Diary
            </ThemedText>
            {mode === 'view' ? (
              <View style={[styles.viewBlock, { backgroundColor: theme.backgroundElement }]}>
                {draft.diary.trim() ? (
                  <MarkdownView>{draft.diary}</MarkdownView>
                ) : (
                  <ThemedText type="default" themeColor="textSecondary">
                    (未記入)
                  </ThemedText>
                )}
              </View>
            ) : (
              <TextInput
                multiline
                textAlignVertical="top"
                value={draft.diary}
                onChangeText={(value) => onAction({ type: 'set-diary', value })}
                placeholder="AI 整理結果（編集可）"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.diaryInput,
                  { color: theme.text, backgroundColor: theme.backgroundElement },
                ]}
              />
            )}
          </View>

          {/* Habits */}
          <View style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
              習慣
            </ThemedText>
            {mode === 'view' ? (
              <View style={[styles.viewBlock, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText
                  type="default"
                  themeColor={checkedHabits.length > 0 ? 'text' : 'textSecondary'}>
                  {checkedHabits.length > 0
                    ? checkedHabits.map(({ label }) => `✓ ${label}`).join('   ')
                    : '(チェックなし)'}
                </ThemedText>
              </View>
            ) : (
              <HabitChecks
                value={draft.habits}
                onToggle={(key) => onAction({ type: 'toggle-habit', key })}
              />
            )}
          </View>
        </ScrollView>
          </Animated.View>
        </GestureDetector>
      </KeyboardAvoidingView>

      <Modal
        visible={!!conflict}
        transparent
        animationType="fade"
        onRequestClose={() => setConflict(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.background }]}>
            <ThemedText type="subtitle">本文の競合</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Notion 側で本文が変更されています。どう保存しますか？
            </ThemedText>
            {conflict && (
              <View
                style={[styles.serverPreview, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Notion 側の本文
                </ThemedText>
                <ScrollView style={styles.serverPreviewScroll}>
                  {conflict.serverBody.trim().length > 0 ? (
                    <MarkdownView>{conflict.serverBody}</MarkdownView>
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      (空)
                    </ThemedText>
                  )}
                </ScrollView>
              </View>
            )}
            <View style={styles.modalButtons}>
              <Pressable
                onPress={() => setConflict(null)}
                style={[styles.modalBtn, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  キャンセル
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={acceptServer}
                style={[styles.modalBtn, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">Notion 側を採用</ThemedText>
              </Pressable>
              <Pressable
                onPress={overwriteServer}
                style={[styles.modalBtn, { backgroundColor: '#cc4444' }]}>
                <ThemedText type="smallBold" style={styles.modalBtnDanger}>
                  上書き保存
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

type StatusPillProps = {
  envOk: boolean;
  entry: ReturnType<typeof useTodayEntry>;
  save: ReturnType<typeof useSaveAll>;
  uploading: boolean;
};

function StatusPill({ envOk, entry, save, uploading }: StatusPillProps) {
  const theme = useTheme();
  let label: string;
  if (!envOk) label = 'Notion 未接続';
  else if (entry.isLoading) label = '読み込み中…';
  else if (entry.isError) label = '読み込み失敗';
  else if (save.isPending) label = '保存中…';
  else if (uploading) label = 'カバー保存中…';
  else if (save.isError) label = '保存失敗';
  else if (entry.data?.notionPageId) label = '同期済み';
  else label = '未保存';

  return (
    <View style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
      {(entry.isLoading || save.isPending || uploading) && (
        <ActivityIndicator size="small" color={theme.textSecondary} />
      )}
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingVertical: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  header: { gap: Spacing.two },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  editActions: { flexDirection: 'row', gap: Spacing.two },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dateNavBtn: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  dateTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dateIcon: {
    fontSize: 16,
    lineHeight: 18,
  },
  headerActionsLeft: {
    flexDirection: 'row',
    gap: Spacing.two,
    flex: 1,
  },
  feelingChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  headerBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.three,
  },
  errorBanner: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.one,
    borderLeftWidth: 3,
    borderLeftColor: '#cc4444',
  },
  errorText: { color: '#cc4444' },
  section: { gap: Spacing.two },
  sectionLabel: { textTransform: 'uppercase' },
  viewBlock: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    minHeight: 44,
  },
  freeText: {
    minHeight: 220,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    fontSize: 16,
    lineHeight: 24,
  },
  aiBtn: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  diaryInput: {
    minHeight: 80,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    fontSize: 15,
    lineHeight: 22,
  },
  coverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coverBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
  },
  coverWrap: {
    position: 'relative',
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    maxWidth: 560,
    maxHeight: 320,
    aspectRatio: 16 / 9,
    alignSelf: 'flex-start',
    backgroundColor: '#00000010',
  },
  coverPendingBadge: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.three,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalBox: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.three,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
  },
  serverPreview: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.one,
    maxHeight: 240,
  },
  serverPreviewScroll: { maxHeight: 200 },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  modalBtn: {
    flex: 1,
    minWidth: 110,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  modalBtnDanger: { color: '#ffffff' },
});
