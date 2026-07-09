import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { ThemedView } from '@/components/themed-view';

/**
 * The きろく tab exists only to put the pen circle in the system tab bar
 * (role="search"). Selecting it bounces straight back to the previous tab
 * and presents the composer as a bottom sheet over it — the tab itself is
 * never a destination.
 */
export default function CaptureTab() {
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      if (router.canGoBack()) router.back();
      else router.navigate('/');
      router.push('/capture-sheet');
    }, [router]),
  );

  return <ThemedView style={{ flex: 1 }} />;
}
