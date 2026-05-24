import { StyleSheet, View } from 'react-native';

import { ScreenContainer } from '@/components/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export function ReflectScreen() {
  return (
    <ScreenContainer>
      <View style={styles.body}>
        <ThemedText type="subtitle">AIふりかえり</ThemedText>
        <ThemedText themeColor="textSecondary">
          ジャーナルをもとにした AI とのチャット形式のふりかえりは Phase 2 で実装します。
        </ThemedText>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
  },
});
