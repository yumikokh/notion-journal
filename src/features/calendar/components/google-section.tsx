import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { GoogleOAuthCancelledError, useGoogleConnection } from '../use-google-connection';

/**
 * Google Calendar connection panel for the Settings screen.
 *
 * Status comes from the server (`google-oauth-status`) — the AsyncStorage
 * flag is only an optimistic hint for offline-ish callers (e.g. widgets).
 */
export function GoogleSection() {
  const theme = useTheme();
  const { status, connect, disconnect } = useGoogleConnection();
  const [actionError, setActionError] = useState<string | null>(null);

  const data = status.data;
  const connected = data?.connected === true;
  const connectedAt = data?.connected === true ? data.connectedAt : null;

  const handleConnect = async () => {
    setActionError(null);
    try {
      await connect.mutateAsync();
    } catch (err) {
      if (err instanceof GoogleOAuthCancelledError) return;
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Google カレンダーを切断',
      '保存された認証情報を削除します。再接続するまで週次AI分析に予定を取り込めなくなります。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '切断',
          style: 'destructive',
          onPress: async () => {
            setActionError(null);
            try {
              await disconnect.mutateAsync();
            } catch (err) {
              setActionError(err instanceof Error ? err.message : String(err));
            }
          },
        },
      ],
    );
  };

  const busy = connect.isPending || disconnect.isPending;

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
        Google カレンダー
      </ThemedText>

      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.cardTitle}>連携状態</ThemedText>
            <StatusLine
              loading={status.isLoading}
              connected={connected}
              connectedAt={connectedAt ?? null}
              error={status.error}
            />
          </View>
          {busy ? (
            <ActivityIndicator />
          ) : connected ? (
            <Pressable
              onPress={handleDisconnect}
              accessibilityRole="button"
              style={[styles.button, { backgroundColor: theme.background }]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                切断
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleConnect}
              accessibilityRole="button"
              style={[styles.button, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold">接続</ThemedText>
            </Pressable>
          )}
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          週次AI分析の入力に、その週の予定を取り込みます。読み取り専用 (calendar.readonly) でアクセスし、トークンは Supabase 側で管理します。
        </ThemedText>

        {actionError && (
          <ThemedText type="small" style={{ color: '#E5484D' }}>
            {actionError}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

function StatusLine({
  loading,
  connected,
  connectedAt,
  error,
}: {
  loading: boolean;
  connected: boolean;
  connectedAt: string | null;
  error: unknown;
}) {
  if (loading) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        確認中…
      </ThemedText>
    );
  }
  if (error) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        状態を取得できませんでした
      </ThemedText>
    );
  }
  if (!connected) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        未接続
      </ThemedText>
    );
  }
  return (
    <ThemedText type="small" themeColor="textSecondary">
      接続済み{connectedAt ? ` ・ ${formatConnectedAt(connectedAt)}` : ''}
    </ThemedText>
  );
}

function formatConnectedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  sectionLabel: {
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardTitle: {
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
  },
  button: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
});
