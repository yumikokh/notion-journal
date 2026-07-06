import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { GoogleSection } from '@/features/calendar/components/google-section';
import { ReminderSection } from '@/features/notifications/components/reminder-section';
import {
  clearCustomPrompt,
  loadCustomPrompt,
  saveCustomPrompt,
} from '@/features/settings/prompt-storage';
import { useTheme } from '@/hooks/use-theme';

export function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [loaded, setLoaded] = useState<string>(''); // last persisted value

  useEffect(() => {
    loadCustomPrompt().then((p) => {
      const text = p ?? '';
      setPrompt(text);
      setLoaded(text);
    });
  }, []);

  const dirty = prompt !== loaded;

  const handleSave = async () => {
    await saveCustomPrompt(prompt);
    setLoaded(prompt);
    Alert.alert('保存しました', 'AI整理ボタン押下時にこのプロンプトが使われます。');
  };

  const handleReset = async () => {
    Alert.alert('デフォルトに戻す', 'カスタムプロンプトを削除してデフォルトに戻しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await clearCustomPrompt();
          setPrompt('');
          setLoaded('');
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}>
        {/* Pushed from the Today header (no tab slot) — bring your own back. */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            accessibilityRole="button"
            accessibilityLabel="戻る"
            hitSlop={8}>
            <ChevronLeft size={24} color={theme.text} strokeWidth={2} />
          </Pressable>
          <ThemedText type="subtitle">設定</ThemedText>
        </View>

        <ReminderSection />

        <GoogleSection />

        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            AI 整理プロンプト
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            空欄なら組み込みのデフォルトを使用します。AI 出力テキストはそのまま
            Diary フィールドに反映されます。
          </ThemedText>

          <TextInput
            multiline
            textAlignVertical="top"
            value={prompt}
            onChangeText={setPrompt}
            placeholder="例: あなたは日記の編集者です。本文からその日のハイライトを短い日記にまとめます…"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.backgroundElement },
            ]}
          />

          <View style={styles.row}>
            <Pressable
              onPress={handleSave}
              disabled={!dirty}
              accessibilityRole="button"
              style={[
                styles.button,
                {
                  backgroundColor: dirty ? theme.backgroundSelected : theme.backgroundElement,
                  opacity: dirty ? 1 : 0.5,
                  flex: 1,
                },
              ]}>
              <ThemedText type="smallBold" themeColor={dirty ? 'text' : 'textSecondary'}>
                保存
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleReset}
              accessibilityRole="button"
              style={[styles.button, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                デフォルトに戻す
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  sectionLabel: {
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 280,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'ui-monospace',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
});
