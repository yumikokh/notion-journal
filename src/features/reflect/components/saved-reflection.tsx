import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { MarkdownView } from '@/components/markdown-view';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useSaveWeeklyReflection } from '../use-save-weekly-reflection';
import { REFLECTION_PROPERTY_NAMES, type WeeklyReflection } from '../weekly-reflection';

type Props = { reflection: WeeklyReflection };

/**
 * Read-only (with an inline edit mode) view of a weekly reflection already
 * saved to Notion.
 *
 * Sync model (see the comment on `WeeklyReflection` for the full write-up):
 *   - The four KPT/focus properties are the reflection's "conclusion" —
 *     owned by the user, editable right here.
 *   - The page body (`bodyMarkdown`) is the AI's full analysis report,
 *     rewritten wholesale on every AI save. It's shown read-only in a
 *     collapsible section so a Notion-side edit to the report is picked up
 *     next time the page loads, without the app clobbering it.
 *
 * The caller should key this component by the week (e.g. `range.start`) so
 * switching weeks remounts it — that resets the edit/collapse state and the
 * draft cleanly instead of syncing it from a prop change in an effect.
 */
const FIELDS = [
  { key: 'good', label: REFLECTION_PROPERTY_NAMES.good, tone: 'accent' },
  { key: 'problem', label: REFLECTION_PROPERTY_NAMES.problem, tone: 'danger' },
  { key: 'tryNext', label: REFLECTION_PROPERTY_NAMES.tryNext, tone: 'accent' },
  { key: 'nextGoal', label: REFLECTION_PROPERTY_NAMES.nextGoal, tone: 'accent' },
] as const;

type FieldKey = (typeof FIELDS)[number]['key'];
type Draft = Record<FieldKey, string>;

function draftFromReflection(r: WeeklyReflection): Draft {
  return { good: r.good, problem: r.problem, tryNext: r.tryNext, nextGoal: r.nextGoal };
}

export function SavedReflection({ reflection }: Props) {
  const theme = useTheme();
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [draft, setDraft] = useState<Draft>(() => draftFromReflection(reflection));
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const saveMutation = useSaveWeeklyReflection();

  const notionUrl = reflection.notionPageId
    ? `https://www.notion.so/${reflection.notionPageId.replace(/-/g, '')}`
    : null;
  const body = reflection.bodyMarkdown.trim();

  const handleEdit = () => {
    setDraft(draftFromReflection(reflection));
    saveMutation.reset();
    setMode('edit');
  };

  const handleCancel = () => {
    saveMutation.reset();
    setMode('view');
  };

  const handleSave = () => {
    saveMutation.mutate(
      { ...reflection, ...draft },
      {
        onSuccess: () => setMode('view'),
      },
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <ThemedText themeColor="textSecondary" type="small" style={styles.description}>
          Notion に保存済みのふりかえりです。
        </ThemedText>
        {mode === 'view' ? (
          <Pressable
            onPress={handleEdit}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="結論を編集"
            style={[styles.editToggle, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">✎ 編集</ThemedText>
          </Pressable>
        ) : null}
      </View>

      {mode === 'view' ? (
        <View style={styles.group}>
          {FIELDS.map(({ key, label, tone }) => {
            const value = reflection[key];
            if (!value) return null;
            const items = value.split('\n').filter((s) => s.length > 0);
            const toneColor = tone === 'danger' ? theme.danger : theme.accent;
            return (
              <View key={key} style={styles.fieldGroup}>
                <View style={[styles.label, { backgroundColor: theme.accentSoft }]}>
                  <ThemedText style={[styles.labelText, { color: toneColor }]}>{label}</ThemedText>
                </View>
                <View style={styles.items}>
                  {items.map((item, i) => (
                    <View
                      key={i}
                      style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                      <ThemedText selectable>{item}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.editForm}>
          {FIELDS.map(({ key, label, tone }) => {
            const toneColor = tone === 'danger' ? theme.danger : theme.accent;
            return (
              <View key={key} style={styles.fieldGroup}>
                <View style={[styles.label, { backgroundColor: theme.accentSoft }]}>
                  <ThemedText style={[styles.labelText, { color: toneColor }]}>{label}</ThemedText>
                </View>
                <TextInput
                  multiline
                  textAlignVertical="top"
                  value={draft[key]}
                  onChangeText={(text) => setDraft((prev) => ({ ...prev, [key]: text }))}
                  placeholder="（未記入）"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.input,
                    { color: theme.text, backgroundColor: theme.backgroundElement },
                  ]}
                />
              </View>
            );
          })}

          <View style={styles.editActions}>
            <Pressable
              onPress={handleSave}
              disabled={saveMutation.isPending}
              style={({ pressed }) => [
                styles.saveButton,
                {
                  backgroundColor: theme.accent,
                  opacity: pressed || saveMutation.isPending ? 0.7 : 1,
                },
              ]}>
              {saveMutation.isPending ? (
                <ActivityIndicator color={theme.background} />
              ) : (
                <ThemedText style={[styles.saveButtonText, { color: theme.background }]}>
                  保存
                </ThemedText>
              )}
            </Pressable>
            <Pressable
              onPress={handleCancel}
              disabled={saveMutation.isPending}
              style={({ pressed }) => [
                styles.cancelButton,
                { borderColor: theme.text, opacity: pressed ? 0.6 : 1 },
              ]}>
              <ThemedText>キャンセル</ThemedText>
            </Pressable>
          </View>
          {saveMutation.error ? (
            <ThemedText
              themeColor="textSecondary"
              type="small"
              style={{ color: theme.danger }}
              selectable>
              保存に失敗しました: {saveMutation.error.message}
            </ThemedText>
          ) : null}
        </View>
      )}

      {body ? (
        <View style={styles.bodySection}>
          <Pressable
            onPress={() => setBodyExpanded((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={bodyExpanded ? 'AI分析の全文を閉じる' : 'AI分析の全文を開く'}
            style={[styles.bodyHeader, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">AI分析の全文</ThemedText>
            {bodyExpanded ? (
              <ChevronUp size={18} color={theme.textSecondary} />
            ) : (
              <ChevronDown size={18} color={theme.textSecondary} />
            )}
          </Pressable>
          {bodyExpanded ? (
            <View style={styles.bodyContent}>
              <MarkdownView>{reflection.bodyMarkdown}</MarkdownView>
            </View>
          ) : null}
        </View>
      ) : null}

      {notionUrl ? (
        <Pressable
          onPress={() => Linking.openURL(notionUrl)}
          style={({ pressed }) => [
            styles.linkButton,
            { borderColor: theme.text, opacity: pressed ? 0.6 : 1 },
          ]}>
          <ThemedText>Notion で開く</ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  description: {
    flex: 1,
  },
  editToggle: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.xl,
  },
  group: {
    gap: Spacing.three,
  },
  editForm: {
    gap: Spacing.three,
  },
  fieldGroup: {
    gap: Spacing.two,
  },
  label: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.sm,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '700',
  },
  items: {
    gap: Spacing.one,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Radius.lg,
  },
  input: {
    padding: Spacing.three,
    borderRadius: Radius.lg,
    minHeight: 72,
    fontSize: 16,
    lineHeight: 24,
  },
  editActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  saveButton: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.xl,
    minWidth: 96,
    alignItems: 'center',
  },
  saveButtonText: {
    fontWeight: '600',
  },
  cancelButton: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  bodySection: {
    gap: Spacing.two,
  },
  bodyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.lg,
  },
  bodyContent: {
    paddingHorizontal: Spacing.one,
  },
  linkButton: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: Spacing.one,
  },
});
