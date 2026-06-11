import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { MarkdownView } from '@/components/markdown-view';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { REFLECTION_PROPERTY_NAMES, type WeeklyReflection } from '../weekly-reflection';

type Props = { reflection: WeeklyReflection };

/**
 * Read-only view of a weekly reflection already saved to Notion.
 *
 * The page body markdown (the full saved analysis) is the source of truth, so
 * we render it directly — this reflects edits made in Notion and shows the
 * summary + patterns, not just the KPT. Older pages without a body fall back
 * to the four KPT/focus properties.
 */
const FIELDS = [
  { key: 'good', label: REFLECTION_PROPERTY_NAMES.good, tone: '#22a06b' },
  { key: 'problem', label: REFLECTION_PROPERTY_NAMES.problem, tone: '#d05545' },
  { key: 'tryNext', label: REFLECTION_PROPERTY_NAMES.tryNext, tone: '#3c87f7' },
  { key: 'nextGoal', label: REFLECTION_PROPERTY_NAMES.nextGoal, tone: '#8a6dd6' },
] as const;

export function SavedReflection({ reflection }: Props) {
  const theme = useTheme();
  const notionUrl = reflection.notionPageId
    ? `https://www.notion.so/${reflection.notionPageId.replace(/-/g, '')}`
    : null;
  const body = reflection.bodyMarkdown.trim();

  return (
    <View style={styles.root}>
      <ThemedText themeColor="textSecondary" type="small">
        Notion に保存済みの週次ふりかえりです。
      </ThemedText>

      {body ? (
        <MarkdownView>{reflection.bodyMarkdown}</MarkdownView>
      ) : (
        // Fallback for pages saved before the body was written: show the four
        // KPT/focus properties.
        FIELDS.map(({ key, label, tone }) => {
          const value = reflection[key];
          if (!value) return null;
          const items = value.split('\n').filter((s) => s.length > 0);
          return (
            <View key={key} style={styles.group}>
              <View style={[styles.label, { backgroundColor: tone }]}>
                <ThemedText style={styles.labelText}>{label}</ThemedText>
              </View>
              <View style={styles.items}>
                {items.map((item, i) => (
                  <View key={i} style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText selectable>{item}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          );
        })
      )}

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
  group: {
    gap: Spacing.two,
  },
  label: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: 4,
  },
  labelText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  items: {
    gap: Spacing.one,
  },
  card: {
    padding: Spacing.three,
    borderRadius: 8,
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
