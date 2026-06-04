import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  invokeGoogleOAuthDisconnect,
  invokeGoogleOAuthExchange,
  invokeGoogleOAuthStatus,
  type GoogleOAuthStatus,
} from '@/lib/supabase';

import { GoogleOAuthCancelledError, runGoogleOAuthFlow } from './google-oauth-client';

const STATUS_QUERY_KEY = ['google-oauth-status'] as const;
const CONNECTED_FLAG_KEY = 'google_calendar_connected';

/**
 * Source of truth for connection state is the server (`google-oauth-status`).
 * The AsyncStorage flag is an optimistic local hint used by widgets/
 * background features that can't (or shouldn't) hit the network.
 */
export function useGoogleConnection() {
  const queryClient = useQueryClient();

  const status = useQuery<GoogleOAuthStatus>({
    queryKey: STATUS_QUERY_KEY,
    queryFn: invokeGoogleOAuthStatus,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const connect = useMutation({
    mutationFn: async () => {
      const { code, codeVerifier, redirectUri } = await runGoogleOAuthFlow();
      const res = await invokeGoogleOAuthExchange({ code, codeVerifier, redirectUri });
      await AsyncStorage.setItem(CONNECTED_FLAG_KEY, 'true');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY });
    },
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      await invokeGoogleOAuthDisconnect();
      await AsyncStorage.removeItem(CONNECTED_FLAG_KEY);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY });
    },
  });

  return { status, connect, disconnect };
}

export { GoogleOAuthCancelledError };
