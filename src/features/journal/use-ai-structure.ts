import { useMutation } from '@tanstack/react-query';

import { invokeAiStructure } from '@/lib/supabase';

import { isValidAIOutput } from './ai-prompt';

type AiStructureInput = {
  bodyText: string;
  systemPrompt?: string; // optional user override from Settings
  calendarContext?: string; // that day's events, pre-formatted as markdown
};

type AiStructureResult = {
  diary: string;
};

/**
 * Run the user's free-form body text through the AI summarization Edge
 * Function and return a validated diary highlight ready for `apply-ai`.
 */
export function useAiStructure() {
  return useMutation<AiStructureResult, Error, AiStructureInput>({
    mutationFn: async ({ bodyText, systemPrompt, calendarContext }) => {
      const result = await invokeAiStructure({ bodyText, systemPrompt, calendarContext });
      if (!isValidAIOutput(result)) {
        throw new Error('AI returned an invalid output shape');
      }
      return { diary: result.diary.trim() };
    },
  });
}
