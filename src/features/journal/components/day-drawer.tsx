import { useQueryClient } from '@tanstack/react-query';
import { Image as CoverImage } from 'expo-image';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Check, PenLine, Sparkles, Trash2, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Radius, Spacing } from '@/constants/theme';
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
import {
  CoverCropModal,
  type CropSource,
} from '@/features/journal/components/cover-crop-modal';
import type { CropRect } from '@/features/journal/cover-crop';
import { coverImageSource } from '@/features/journal/cover-image';
import { useAiStructure } from '@/features/journal/use-ai-structure';
import { useRemoveCover } from '@/features/journal/use-remove-cover';
import { useSaveAll } from '@/features/journal/use-save-today';
import { useTodayEntry } from '@/features/journal/use-today-entry';
import { useUploadCover } from '@/features/journal/use-upload-cover';
import { emptySnapshot } from '@/features/notion/mapping';
import type { TodayEntrySnapshot } from '@/features/notion/types';
import type { MonthEntry, NotionSelectColor } from '@/lib/supabase';
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

/**
 * The drawer's inner editor, exported so the きろく sheet can morph into
 * it when pulled up to full height (same content, no second modal).
 */
export function DayDrawerContent({
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
  const queryClient = useQueryClient();

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

  // Photo picked from the library, awaiting its 16:9 crop. Keeps the
  // original base64 around as a fallback for dev clients built before
  // expo-image-manipulator was added.
  const [cropSource, setCropSource] = useState<
    (CropSource & { base64: string; mimeType: string; filename?: string }) | null
  >(null);
  const [cropping, setCropping] = useState(false);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.7,
      base64: true,
      // The 16:9 crop happens in our own CoverCropModal — the OS editor
      // only offers a square crop box.
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) return;
    setCropSource({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
      base64: asset.base64,
      mimeType: asset.mimeType ?? 'image/jpeg',
      filename: asset.fileName ?? undefined,
    });
  };

  const handleCropConfirm = async (rect: CropRect) => {
    if (!cropSource) return;
    setCropping(true);
    try {
      const cropped = await manipulateAsync(cropSource.uri, [{ crop: rect }], {
        compress: 0.8,
        format: SaveFormat.JPEG,
        base64: true,
      });
      if (!cropped.base64) throw new Error('crop produced no data');
      setPendingPhoto({
        uri: cropped.uri,
        base64: cropped.base64,
        mimeType: 'image/jpeg',
        filename: cropSource.filename ?? 'cover.jpg',
      });
    } catch {
      // Most likely an older dev client without the image-manipulator
      // native module — fall back to the uncropped photo.
      Alert.alert(
        'トリミングできませんでした',
        '選択した写真をそのままカバーに設定します。（開発ビルドの更新が必要かもしれません）',
      );
      setPendingPhoto({
        uri: cropSource.uri,
        base64: cropSource.base64,
        mimeType: cropSource.mimeType,
        filename: cropSource.filename,
      });
    } finally {
      setCropping(false);
      setCropSource(null);
    }
  };

  const canAi = draft.freeText.trim().length > 0 && !ai.isPending && envOk;
  // While the per-day entry is still loading, seed the cover from the month
  // query cache (the calendar/list already downloaded it) so opening a day
  // shows its photo instantly instead of a blank slot that pops in later.
  const cachedMonthCover = useMemo(() => {
    if (entry.data) return null;
    const monthEntries = queryClient.getQueryData<MonthEntry[]>([
      'journal',
      'month',
      date.slice(0, 7),
    ]);
    return monthEntries?.find((e) => e.date === date)?.coverUrl ?? null;
  }, [entry.data, queryClient, date]);
  const displayCoverUri = pendingPhoto?.uri ?? entry.data?.coverUrl ?? cachedMonthCover;
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
                      backgroundColor: theme.accent,
                      opacity: isSaving ? 0.5 : 1,
                    },
                  ]}>
                  <ThemedText type="smallBold" style={styles.saveBtnText}>
                    {isSaving ? '保存中…' : '保存'}
                  </ThemedText>
                </Pressable>
              )}
              <Pressable
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="閉じる"
                hitSlop={8}
                style={[styles.closeBtn, { backgroundColor: theme.backgroundElement }]}>
                <X size={16} color={theme.textSecondary} strokeWidth={2} />
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
                  {
                    backgroundColor: theme.backgroundElement,
                    borderLeftColor: theme.danger,
                    marginHorizontal: Spacing.four,
                  },
                ]}>
                {entry.error && (
                  <ThemedText type="small" style={[styles.errorText, { color: theme.danger }]}>
                    読み込み: {entry.error.message}
                  </ThemedText>
                )}
                {saveAll.error && (
                  <ThemedText type="small" style={[styles.errorText, { color: theme.danger }]}>
                    保存: {saveAll.error.message}
                  </ThemedText>
                )}
                {uploadCover.error && (
                  <ThemedText type="small" style={[styles.errorText, { color: theme.danger }]}>
                    カバー: {uploadCover.error.message}
                  </ThemedText>
                )}
                {removeCover.error && (
                  <ThemedText type="small" style={[styles.errorText, { color: theme.danger }]}>
                    カバー削除: {removeCover.error.message}
                  </ThemedText>
                )}
                {ai.error && (
                  <ThemedText type="small" style={[styles.errorText, { color: theme.danger }]}>
                    AIまとめ: {ai.error.message}
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
                  <CoverImage
                    source={coverImageSource(displayCoverUri)}
                    style={styles.coverImage}
                    contentFit="cover"
                    transition={150}
                  />
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
                <View style={[styles.coverEmpty, { borderColor: theme.backgroundSelected }]}>
                  <Camera size={20} color={theme.textSecondary} strokeWidth={1.6} />
                  <ThemedText type="small" themeColor="textSecondary">
                    カバー写真を選ぶ
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
                <View style={styles.sectionHeader}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    DIARY
                  </ThemedText>
                  <Pressable
                    onPress={handleAi}
                    disabled={!canAi}
                    accessibilityRole="button"
                    accessibilityLabel="本文からDIARYをまとめる"
                    accessibilityState={{ disabled: !canAi, busy: ai.isPending }}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.ghostBtn,
                      { opacity: !canAi ? 0.35 : pressed ? 0.6 : 1 },
                    ]}>
                    {ai.isPending ? (
                      <ActivityIndicator size="small" color={theme.accent} />
                    ) : (
                      <Sparkles size={13} color={theme.accent} strokeWidth={2} />
                    )}
                    <ThemedText type="smallBold" style={{ color: theme.accent }}>
                      {ai.isPending ? 'まとめ中' : 'まとめる'}
                    </ThemedText>
                  </Pressable>
                </View>
                <TextInput
                  multiline
                  textAlignVertical="top"
                  value={draft.diary}
                  onChangeText={(value) => onAction({ type: 'set-diary', value })}
                  placeholder="今日をひとことで（✨で本文からまとめられます）"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.diaryInput,
                    { color: theme.text, backgroundColor: theme.backgroundElement },
                  ]}
                />
              </View>

              {/* 予定 — Google Calendar; renders nothing when disconnected */}
              <DayEventsSection date={date} />

              {/* 本文 — only section with header + view/edit toggle */}
              <View style={styles.bodySection}>
                <View style={styles.sectionHeader}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    本文
                  </ThemedText>
                  <Pressable
                    onPress={() =>
                      setBodyMode((prev) => (prev === 'view' ? 'edit' : 'view'))
                    }
                    accessibilityRole="button"
                    accessibilityLabel={bodyMode === 'view' ? '本文を編集' : '本文の編集を閉じる'}
                    hitSlop={8}
                    style={({ pressed }) => [styles.ghostBtn, { opacity: pressed ? 0.6 : 1 }]}>
                    {bodyMode === 'view' ? (
                      <PenLine size={13} color={theme.textSecondary} strokeWidth={2} />
                    ) : (
                      <Check size={13} color={theme.accent} strokeWidth={2.5} />
                    )}
                    <ThemedText
                      type="smallBold"
                      style={{
                        color: bodyMode === 'view' ? theme.textSecondary : theme.accent,
                      }}>
                      {bodyMode === 'view' ? '編集' : '完了'}
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
                style={[styles.conflictBtn, { backgroundColor: theme.danger }]}>
                <ThemedText type="smallBold" style={styles.conflictBtnDanger}>
                  上書き保存
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <CoverCropModal
        source={cropSource}
        busy={cropping}
        onCancel={() => setCropSource(null)}
        onConfirm={handleCropConfirm}
      />
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
    height: 32,
    paddingHorizontal: Spacing.three + 2,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#ffffff',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  // Cover — a rounded card, aligned with the body's horizontal rhythm.
  coverPressable: {
    width: '100%',
    paddingHorizontal: Spacing.four,
  },
  coverWrap: {
    width: '100%',
    position: 'relative',
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#00000010',
  },
  coverEmpty: {
    width: '100%',
    height: 96,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
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

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 30,
  },
  diaryGroup: { gap: Spacing.two },
  diaryInput: {
    minHeight: 88,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    fontSize: 15,
    lineHeight: 22,
  },
  // Text-style ("ghost") header actions: no fill, just icon + short label —
  // pills next to section labels read heavier than the content they act on.
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: Spacing.one,
  },

  bodySection: { gap: Spacing.two },
  viewBlock: {
    padding: Spacing.three,
    borderRadius: Radius.lg,
    minHeight: 80,
  },
  freeText: {
    minHeight: 240,
    padding: Spacing.three,
    borderRadius: Radius.lg,
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
    borderRadius: Radius.lg,
    gap: Spacing.one,
    borderLeftWidth: 3,
  },
  errorText: {},

  conflictOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  conflictBox: {
    padding: Spacing.four,
    borderRadius: Radius.xl,
    gap: Spacing.three,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
  },
  conflictPreview: {
    padding: Spacing.three,
    borderRadius: Radius.lg,
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
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  conflictBtnDanger: { color: '#ffffff' },
});
