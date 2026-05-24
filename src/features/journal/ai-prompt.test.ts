import { describe, expect, it } from '@jest/globals';

import { isValidAIOutput } from './ai-prompt';

describe('isValidAIOutput', () => {
  it('accepts a non-empty diary string', () => {
    expect(isValidAIOutput({ diary: 'ジョギングして気持ちよかった一日。' })).toBe(true);
  });

  it('rejects an empty or whitespace-only diary', () => {
    expect(isValidAIOutput({ diary: '' })).toBe(false);
    expect(isValidAIOutput({ diary: '   \n  ' })).toBe(false);
  });

  it('rejects non-string diary values', () => {
    expect(isValidAIOutput({ diary: 123 })).toBe(false);
    expect(isValidAIOutput({ diary: null })).toBe(false);
    expect(isValidAIOutput({})).toBe(false);
  });

  it('rejects null and primitive values', () => {
    expect(isValidAIOutput(null)).toBe(false);
    expect(isValidAIOutput('hi')).toBe(false);
    expect(isValidAIOutput(42)).toBe(false);
  });
});
