import * as ImagePicker from 'expo-image-picker';
import { Sparkles, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MarkdownView } from '@/components/markdown-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { buildDayCalendarContext } from '@/features/calendar/calendar-context';
import { DayEventsSection } from '@/features/calendar/components/day-events-section';
import { useDayEvents } from '@/features/calendar/use-day-events';
import { FeelingPicker } from '@/features/journal/components/feeling-picker';
import { HabitChecks } from '@/features/journal/components/habit-checks';
import {
  draftReducer,
  draftToSnapshot,
  EMPTY_DRAFT,
  isDraftDirty,
  type Feeling,
  type UserDraftAction,
} from '@/features/journal/draft';
import { useAiStructure } from '@/features/journal/use-ai-structure';
import { useRemoveCover } from '@/features/journal/use-remove-cover';
import { useSaveAll } from '@/features/journal/use-save-today';
import { useTodayEntry } from '@/features/journal/use-today-entry';
import { useUploadCover } from '@/features/journal/use-upload-cover';
import { emptySnapshot } from '@/features/notion/mapping';
import type { TodayEntrySnapshot } from '@/features/notion/types';
import type { NotionSelectColor } from '@/lib/supabase';
import { loadCustomPrompt } from '@/features/settings/prompt-storage';
import { useTheme } from '@/hooks/use-theme';
import { formatJournalTitle } from '@/lib/date';
import { isSupabaseEnvConfigured } from '@/lib/env';

type PendingPhoto = {
  uri: string;
  base64: string;
  mimeType: string;
  filename?: string;
};

type DayDrawerProps = {
  /** Date key (YYYY-MM-DD) of the entry being viewed. `null` closes the drawer. */
  date: string | null;
  onClose: () => void;
  /**
   * Notion select color per feeling, aggregated from already-loaded month
   * data so the FeelingPicker can tint all options — not just the current
   * selection — using the user's Notion palette.
   */
  feelingColors?: Partial<Record<Feeling, NotionSelectColor | null>>;
};

/**
 * Day editor presented as an iOS pageSheet from the calendar.
 *
 * Layout order (no section headers except for 本文):
 *   cover photo (full-bleed) → 気分 → 習慣 → DIARY → 本文.
 *
 * Body has a separate ✎ 編集 ↔ 💾 保存 mode. All other fields are inline-
 * editable. A single 💾 保存 button at the top persists the whole draft
 * (properties + body + pending cover) when anything is dirty.
 */
export function DayDrawer({ date, onClose, feelingColors }: DayDrawerProps) {
  const visible = date !== null;
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      {date !== null && (
        <DayDrawerContent date={date} onClose={onClose} feelingColors={feelingColors} />
      )}
    </Modal>
  );
}

function DayDrawerContent({
  date,
  onClose,
  feelingColors,
}: {
  date: string;
  onClose: () => void;
  feelingColors?: Partial<Record<Feeling, NotionSelectColor | null>>;
}) {
  const theme = useTheme();
  const envOk = isSupabaseEnvConfigured();
  // AI button uses the high-contrast "filled" treatment — black in light
  // mode, white in dark mode — matching the primary 保存 button so both
  // primary actions feel like first-class buttons.
  const aiBg = theme.text;
  const aiFg = theme.background;

  const dateObj = useMemo(() => new Date(`${date}T00:00:00`), [date]);

  const entry = useTodayEntry(date, { enabled: envOk });
  const saveAll = useSaveAll();
  const uploadCover = useUploadCover();
  const removeCover = useRemoveCover();
  const ai = useAiStructure();
  // Reuses the same cached query as <DayEventsSection> below — no extra
  // fetch. Empty/undefined when Google Calendar isn't connected, in which
  // case the AI call stays journal-only.
  const dayEvents = useDayEvents(date);

  // Merge the calendar-derived color map with the color of THIS entry's
  // feeling — the latter is always fresh and may include a feeling that
  // hasn't appeared elsewhere in the month yet.
  const mergedFeelingColors = useMemo(() => {
    const m: Partial<Record<Feeling, NotionSelectColor | null>> = { ...(feelingColors ?? {}) };
    if (entry.data?.feeling && !(entry.data.feeling in m)) {
      m[entry.data.feeling] = entry.data.feelingColor;
    }
    return m;
  }, [feelingColors, entry.data]);

  const [draft, dispatch] = useReducer(draftReducer, EMPTY_DRAFT);
  const initializedRef = useRef(false);
  const [lastSyncedBody, setLastSyncedBody] = useState<string | null>(null);
  const [bodyMode, setBodyMode] = useState<'view' | 'edit'>('view');
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null);
  const [conflict, setConflict] = useState<{
    serverBody: string;
    freshSnapshot: TodayEntrySnapshot;
  } | null>(null);

  // Seed the local draft once the Notion entry resolves.
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

  const baseSnap = entry.data ?? emptySnapshot(date);

  const isDirty = useMemo(
    () => isDraftDirty(draft, entry.data ?? null, lastSyncedBody, pendingPhoto !== null),
    [draft, entry.data, lastSyncedBody, pendingPhoto],
  );

  const isSaving = saveAll.isPending || uploadCover.isPending || removeCover.isPending;

  const doSave = useCallback(async () => {
    const snap = draftToSnapshot(draft, baseSnap);
    const saved = await saveAll.mutateAsync({ snapshot: snap, lastSyncedBody });
    setLastSyncedBody(saved.bodyMarkdown);

    if (pendingPhoto && saved.notionPageId) {
      await uploadCover.mutateAsync({
        notionPageId: saved.notionPageId,
        date: saved.date,
        base64: pendingPhoto.base64,
        mimeType: pendingPhoto.mimeType,
        filename: pendingPhoto.filename,
        uri: pendingPhoto.uri,
      });
      setPendingPhoto(null);
    }

    setBodyMode('view');
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

  const acceptServer = () => {
    if (!conflict) return;
    dispatch({ type: 'init', from: conflict.freshSnapshot });
    setLastSyncedBody(conflict.serverBody);
    setConflict(null);
    setBodyMode('view');
  };

  const overwriteServer = async () => {
    setConflict(null);
    await doSave();
  };

  const handleClose = () => {
    if (bodyMode === 'edit') {
      // Drop in-progress body edits — properties are still in the draft.
      const source = entry.data ?? emptySnapshot(date);
      dispatch({ type: 'set-free-text', value: source.bodyMarkdown });
    }
    onClose();
  };

  const handleAi = async () => {
    if (!envOk || draft.freeText.trim().length === 0 || ai.isPending) return;
    const customPrompt = await loadCustomPrompt();
    const calendarContext = buildDayCalendarContext(dayEvents.data ?? []);
    ai.mutate(
      {
        bodyText: draft.freeText,
        systemPrompt: customPrompt ?? undefined,
        calendarContext: calendarContext || undefined,
      },
      {
        onSuccess: (output) => dispatch({ type: 'apply-ai', diary: output.diary }),
      },
    );
  };

  const removeCoverNow = async () => {
    // Pending (not yet saved) photo: clear local state only — never hit Notion.
    if (pendingPhoto) {
      setPendingPhoto(null);
      return;
    }
    // No saved cover, nothing to do.
    const pageId = entry.data?.notionPageId;
    if (!pageId) return;
    await removeCover.mutateAsync({ notionPageId: pageId, date });
  };

  const handleRemoveCover = () => {
    // Skip confirmation for pending-only state — there's nothing destructive
    // to confirm, the user can just pick a new photo or re-tap if they meant
    // to keep it.
    if (pendingPhoto && !entry.data?.coverUrl) {
      setPendingPhoto(null);
      return;
    }
    Alert.alert('カバー写真を削除', 'Notion ページのカバーを外します。よろしいですか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          removeCoverNow().catch(() => {
            // Error surfaces via the error banner (removeCover.error).
          });
        },
      },
    ]);
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

  const canAi = draft.freeText.trim().length > 0 && !ai.isPending && envOk;
  const displayCoverUri = pendingPhoto?.uri ?? entry.data?.coverUrl ?? null;
  const pageIcon = entry.data?.icon;

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Top bar: title + status + 保存 + close */}
          <View style={[styles.topBar, { borderBottomColor: theme.backgroundElement }]}>
            <View style={styles.topBarTitle}>
              {pageIcon?.type === 'emoji' && (
                <ThemedText style={styles.titleIcon}>{pageIcon.emoji}</ThemedText>
              )}
              <ThemedText type="subtitle" numberOfLines={1}>
                {formatJournalTitle(dateObj)}
              </ThemedText>
            </View>
            <View style={styles.topBarActions}>
              <StatusDot
                envOk={envOk}
                entry={entry}
                save={saveAll}
                uploading={uploadCover.isPending}
              />
              {isDirty && (
                <Pressable
                  onPress={handleSave}
                  disabled={isSaving}
                  accessibilityRole="button"
                  accessibilityLabel="保存"
                  style={[
                    styles.saveBtn,
                    {
                      backgroundColor: theme.text,
                      opacity: isSaving ? 0.5 : 1,
                    },
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: theme.background }}>
                    {isSaving ? '保存中…' : '保存'}
                  </ThemedText>
                </Pressable>
              )}
              <Pressable
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="閉じる"
                hitSlop={8}
                style={styles.closeBtn}>
                <ThemedText type="subtitle" themeColor="textSecondary">
                  ✕
                </ThemedText>
              </Pressable>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* Errors */}
            {(entry.error || saveAll.error || ai.error || uploadCover.error || removeCover.error) && (
              <View
                style={[
                  styles.errorBanner,
                  { backgroundColor: theme.backgroundElement, marginHorizontal: Spacing.four },
                ]}>
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
                {removeCover.error && (
                  <ThemedText type="small" style={styles.errorText}>
                    🗑️ カバー削除: {removeCover.error.message}
                  </ThemedText>
                )}
                {ai.error && (
                  <ThemedText type="small" style={styles.errorText}>
                    ✨ AI: {ai.error.message}
                  </ThemedText>
                )}
              </View>
            )}

            {/* Cover photo — full bleed, tap to change */}
            <Pressable
              onPress={pickPhoto}
              accessibilityRole="button"
              accessibilityLabel={displayCoverUri ? 'カバー写真を変更' : 'カバー写真を選ぶ'}
              disabled={isSaving}
              style={styles.coverPressable}>
              {displayCoverUri ? (
                <View style={styles.coverWrap}>
                  <Image source={{ uri: displayCoverUri }} style={styles.coverImage} />
                  {pendingPhoto && (
                    <View
                      style={[
                        styles.coverBadge,
                        { backgroundColor: theme.backgroundSelected },
                      ]}>
                      <ThemedText type="small" themeColor="textSecondary">
                        保存待ち
                      </ThemedText>
                    </View>
                  )}
                  <Pressable
                    onPress={handleRemoveCover}
                    disabled={isSaving}
                    accessibilityRole="button"
                    accessibilityLabel={pendingPhoto ? '選択した写真をやめる' : 'カバー写真を削除'}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.coverRemoveBtn,
                      {
                        backgroundColor: 'rgba(0,0,0,0.55)',
                        opacity: pressed ? 0.7 : isSaving ? 0.4 : 1,
                      },
                    ]}>
                    <Trash2 size={16} color="#ffffff" strokeWidth={2} />
                  </Pressable>
                </View>
              ) : (
                <View
                  style={[
                    styles.coverEmpty,
                    { backgroundColor: theme.backgroundElement },
                  ]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    📷 カバー写真を選ぶ
                  </ThemedText>
                </View>
              )}
            </Pressable>

            <View style={styles.body}>
              {/* 気分 — inline, no header */}
              <FeelingPicker
                value={draft.feeling}
                onChange={(value) => onAction({ type: 'set-feeling', value })}
                colorMap={mergedFeelingColors}
              />

              {/* 習慣 — inline, no header */}
              <HabitChecks
                value={draft.habits}
                onToggle={(key) => onAction({ type: 'toggle-habit', key })}
              />

              {/* DIARY — inline TextInput, AI button always visible */}
              <View style={styles.diaryGroup}>
                <TextInput
                  multiline
                  textAlignVertical="top"
                  value={draft.diary}
                  onChangeText={(value) => onAction({ type: 'set-diary', value })}
                  placeholder="DIARY（AIで本文をまとめてここに）"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.diaryInput,
                    { color: theme.text, backgroundColor: theme.backgroundElement },
                  ]}
                />
                <Pressable
                  onPress={handleAi}
                  disabled={!canAi}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canAi, busy: ai.isPending }}
                  style={[
                    styles.aiBtn,
                    {
                      backgroundColor: aiBg,
                      opacity: canAi ? 1 : 0.5,
                    },
                  ]}>
                  <Sparkles size={14} color={aiFg} strokeWidth={2} />
                  <ThemedText type="smallBold" style={{ color: aiFg }}>
                    {ai.isPending ? '整理中…' : '本文を DIARY にまとめる'}
                  </ThemedText>
                </Pressable>
              </View>

              {/* 予定 — Google Calendar; renders nothing when disconnected */}
              <DayEventsSection date={date} />

              {/* 本文 — only section with header + view/edit toggle */}
              <View style={styles.bodySection}>
                <View style={styles.bodyHeader}>
                  <ThemedText
                    type="smallBold"
                    themeColor="textSecondary"
                    style={styles.bodyLabel}>
                    本文
                  </ThemedText>
                  <Pressable
                    onPress={() =>
                      setBodyMode((prev) => (prev === 'view' ? 'edit' : 'view'))
                    }
                    accessibilityRole="button"
                    accessibilityLabel={bodyMode === 'view' ? '本文を編集' : '本文の編集を閉じる'}
                    hitSlop={8}
                    style={[
                      styles.bodyToggle,
                      { backgroundColor: theme.backgroundElement },
                    ]}>
                    <ThemedText type="smallBold">
                      {bodyMode === 'view' ? '✎ 編集' : '✓ 完了'}
                    </ThemedText>
                  </Pressable>
                </View>
                {bodyMode === 'view' ? (
                  <View
                    style={[
                      styles.viewBlock,
                      { backgroundColor: theme.backgroundElement },
                    ]}>
                    {draft.freeText.trim() ? (
                      <MarkdownView>{draft.freeText}</MarkdownView>
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
                    value={draft.freeText}
                    onChangeText={(value) => onAction({ type: 'set-free-text', value })}
                    placeholder="今日あったこと、感じたことを自由に書く…"
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.freeText,
                      { color: theme.text, backgroundColor: theme.backgroundElement },
                    ]}
                  />
                )}
              </View>

              {/* Loading indicator while the first fetch is in flight */}
              {entry.isLoading && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    読み込み中…
                  </ThemedText>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal
        visible={!!conflict}
        transparent
        animationType="fade"
        onRequestClose={() => setConflict(null)}>
        <View style={styles.conflictOverlay}>
          <View style={[styles.conflictBox, { backgroundColor: theme.background }]}>
            <ThemedText type="subtitle">本文の競合</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Notion 側で本文が変更されています。どう保存しますか？
            </ThemedText>
            {conflict && (
              <View
                style={[
                  styles.conflictPreview,
                  { backgroundColor: theme.backgroundElement },
                ]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Notion 側の本文
                </ThemedText>
                <ScrollView style={styles.conflictPreviewScroll}>
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
            <View style={styles.conflictButtons}>
              <Pressable
                onPress={() => setConflict(null)}
                style={[styles.conflictBtn, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  キャンセル
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={acceptServer}
                style={[styles.conflictBtn, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">Notion 側を採用</ThemedText>
              </Pressable>
              <Pressable
                onPress={overwriteServer}
                style={[styles.conflictBtn, { backgroundColor: '#cc4444' }]}>
                <ThemedText type="smallBold" style={styles.conflictBtnDanger}>
                  上書き保存
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

type StatusDotProps = {
  envOk: boolean;
  entry: ReturnType<typeof useTodayEntry>;
  save: ReturnType<typeof useSaveAll>;
  uploading: boolean;
};

function StatusDot({ envOk, entry, save, uploading }: StatusDotProps) {
  const theme = useTheme();
  let label: string;
  if (!envOk) label = '未接続';
  else if (entry.isLoading) label = '読み込み中…';
  else if (entry.isError) label = '読み込み失敗';
  else if (save.isPending) label = '保存中…';
  else if (uploading) label = 'カバー保存中…';
  else if (save.isError) label = '保存失敗';
  else if (entry.data?.notionPageId) label = '同期済み';
  else label = '未保存';

  return (
    <View style={styles.statusDot}>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  topBarTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  titleIcon: { fontSize: 18, lineHeight: 22 },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  statusDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  saveBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
  },
  closeBtn: {
    paddingHorizontal: Spacing.one,
    paddingVertical: 0,
  },
  scrollContent: {
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  // Cover — full bleed, no horizontal padding
  coverPressable: { width: '100%' },
  coverWrap: { width: '100%', position: 'relative' },
  coverImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#00000010',
  },
  coverEmpty: {
    width: '100%',
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverBadge: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.three,
  },
  coverRemoveBtn: {
    position: 'absolute',
    top: Spacing.two,
    // Sit on the LEFT so it never overlaps the "保存待ち" badge on the right.
    left: Spacing.two,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },

  diaryGroup: { gap: Spacing.two },
  diaryInput: {
    minHeight: 80,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    fontSize: 15,
    lineHeight: 22,
  },
  aiBtn: {
    flexDirection: 'row',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bodySection: { gap: Spacing.two },
  bodyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bodyLabel: { textTransform: 'uppercase' },
  bodyToggle: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
  },
  viewBlock: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    minHeight: 80,
  },
  freeText: {
    minHeight: 240,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    fontSize: 16,
    lineHeight: 24,
  },

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },

  errorBanner: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.one,
    borderLeftWidth: 3,
    borderLeftColor: '#cc4444',
  },
  errorText: { color: '#cc4444' },

  conflictOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  conflictBox: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.three,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
  },
  conflictPreview: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.one,
    maxHeight: 240,
  },
  conflictPreviewScroll: { maxHeight: 200 },
  conflictButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  conflictBtn: {
    flex: 1,
    minWidth: 110,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  conflictBtnDanger: { color: '#ffffff' },
});
