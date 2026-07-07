import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { ArrowUp } from 'lucide-react-native';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { formatTimeLabel } from '@/features/today/today-log';
import { useTheme } from '@/hooks/use-theme';

const glassOk = isLiquidGlassAvailable();

type Props = {
  visible: boolean;
  onClose: () => void;
  /**
   * Fire the timestamped append. The sheet closes optimistically right
   * after submitting — the caller owns the mutation (and its error alert),
   * so nothing is lost when this unmounts.
   */
  onSubmit: (text: string) => void;
};

/**
 * The floating ＋ button's capture sheet: one input, one send. No preview,
 * no summarizing — the whole point is that a feeling becomes a timestamped
 * log line in the daily page body within two taps.
 */
export function QuickCaptureSheet({ visible, onClose, onSubmit }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {visible && <SheetContent onClose={onClose} onSubmit={onSubmit} />}
    </Modal>
  );
}

function SheetContent({ onClose, onSubmit }: Pick<Props, 'onClose' | 'onSubmit'>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const canSend = text.trim().length > 0;

  const send = () => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    onSubmit(trimmed);
    onClose();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={styles.backdrop} accessibilityLabel="閉じる" onPress={onClose} />
      <GlassView
        glassEffectStyle="regular"
        style={[
          styles.card,
          { paddingBottom: Math.max(insets.bottom, Spacing.two) },
          !glassOk && { backgroundColor: theme.background },
        ]}>
        <ThemedText type="small" themeColor="textSecondary">
          {formatTimeLabel(new Date())} のきもち
        </ThemedText>
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
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
            <ArrowUp size={18} color="#ffffff" strokeWidth={2.5} />
          </Pressable>
        </View>
      </GlassView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  card: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    overflow: 'hidden',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two + 2,
    paddingBottom: Spacing.two + 2,
    fontSize: 16,
    lineHeight: 21,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
