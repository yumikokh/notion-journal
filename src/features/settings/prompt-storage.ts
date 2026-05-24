import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * User-overridable AI structuring prompt. Stored locally only.
 * `null` means "use the default in `ai-prompt.ts`".
 */

const KEY = 'notion-journal.ai_prompt';

export async function loadCustomPrompt(): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(KEY);
    return value && value.trim().length > 0 ? value : null;
  } catch {
    return null;
  }
}

export async function saveCustomPrompt(text: string): Promise<void> {
  if (text.trim().length === 0) {
    await AsyncStorage.removeItem(KEY);
    return;
  }
  await AsyncStorage.setItem(KEY, text);
}

export async function clearCustomPrompt(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
