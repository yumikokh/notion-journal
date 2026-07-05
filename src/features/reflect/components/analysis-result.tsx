import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { WeeklyAnalysis } from '../weekly-analysis';

type Props = {
  analysis: WeeklyAnalysis;
  dailyCount: number;
  calendarEventCount: number;
};

export function AnalysisResult({ analysis, dailyCount, calendarEventCount }: Props) {
  const subtitle =
    calendarEventCount > 0
      ? `${dailyCount}日分のジャーナル + 予定 ${calendarEventCount} 件から`
      : `${dailyCount}日分のジャーナルから`;
  return (
    <View style={styles.root}>
      <Section title="サマリー" subtitle={subtitle}>
        <ThemedText>{analysis.summary}</ThemedText>
      </Section>

      <Section title="気付き・パターン">
        <BulletList items={analysis.patterns} />
      </Section>

      <Section title="KPT 案">
        <KptGroup label="Keep" items={analysis.kpt.keep} tone="keep" />
        <KptGroup label="Problem" items={analysis.kpt.problem} tone="problem" />
        <KptGroup label="Try" items={analysis.kpt.try} tone="try" />
      </Section>

      <Section title="来週のフォーカス">
        <BulletList items={analysis.nextFocus} />
      </Section>
    </View>
  );
}

type SectionProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

function Section({ title, subtitle, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText type="smallBold">{title}</ThemedText>
        {subtitle ? (
          <ThemedText themeColor="textSecondary" type="small">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return (
      <ThemedText themeColor="textSecondary" type="small">
        （該当なし）
      </ThemedText>
    );
  }
  return (
    <View style={styles.bulletList}>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <ThemedText themeColor="textSecondary">・</ThemedText>
          <ThemedText style={styles.bulletText} selectable>
            {item}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

// Notion への保存は ReflectScreen の「Notionに保存」ボタンが担う（#16）。
// テキストは `selectable` のままにして、個別の項目を長押しコピーもできる。
type KptTone = 'keep' | 'problem' | 'try';

function KptGroup({ label, items, tone }: { label: string; items: string[]; tone: KptTone }) {
  const theme = useTheme();
  // Same gentle labeling as SavedReflection: soft accent chip, tinted text.
  const toneColor = tone === 'problem' ? theme.danger : theme.accent;
  return (
    <View style={styles.kptGroup}>
      <View style={[styles.kptLabel, { backgroundColor: theme.accentSoft }]}>
        <ThemedText style={[styles.kptLabelText, { color: toneColor }]}>{label}</ThemedText>
      </View>
      {items.length === 0 ? (
        <ThemedText themeColor="textSecondary" type="small">
          （該当なし）
        </ThemedText>
      ) : (
        <View style={styles.kptItems}>
          {items.map((item, i) => (
            <View
              key={i}
              style={[styles.kptCard, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText selectable>{item}</ThemedText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionBody: {
    gap: Spacing.two,
  },
  bulletList: {
    gap: Spacing.one,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  bulletText: {
    flex: 1,
  },
  kptGroup: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  kptLabel: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.sm,
  },
  kptLabelText: {
    fontSize: 12,
    fontWeight: '700',
  },
  kptItems: {
    gap: Spacing.one,
  },
  kptCard: {
    padding: Spacing.three,
    borderRadius: Radius.lg,
  },
});
