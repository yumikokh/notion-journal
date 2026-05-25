import { describe, expect, it } from '@jest/globals';

import { isWeeklyAnalysis, isWeeklyAnalysisResponse } from './weekly-analysis';

const validAnalysis = {
  summary: '今週は新機能の実装で忙しかったが、運動の習慣は維持できた。',
  patterns: ['夜更かしが続いた', '集中時間は午前に偏った'],
  kpt: {
    keep: ['朝の30分集中タイム'],
    problem: ['夜のスクリーンタイム過多'],
    try: ['就寝1時間前は読書に切り替える'],
  },
  nextFocus: ['睡眠の質', 'ふりかえり時間の確保'],
};

describe('isWeeklyAnalysis', () => {
  it('accepts a well-formed analysis', () => {
    expect(isWeeklyAnalysis(validAnalysis)).toBe(true);
  });

  it('rejects when summary is empty or missing', () => {
    expect(isWeeklyAnalysis({ ...validAnalysis, summary: '' })).toBe(false);
    expect(isWeeklyAnalysis({ ...validAnalysis, summary: '   ' })).toBe(false);
    const { summary: _summary, ...withoutSummary } = validAnalysis;
    expect(isWeeklyAnalysis(withoutSummary)).toBe(false);
  });

  it('rejects when patterns is not a string array', () => {
    expect(isWeeklyAnalysis({ ...validAnalysis, patterns: 'oops' })).toBe(false);
    expect(isWeeklyAnalysis({ ...validAnalysis, patterns: [1, 2] })).toBe(false);
  });

  it('rejects when kpt is missing or partial', () => {
    expect(isWeeklyAnalysis({ ...validAnalysis, kpt: undefined })).toBe(false);
    expect(
      isWeeklyAnalysis({
        ...validAnalysis,
        kpt: { keep: [], problem: [] }, // try missing
      }),
    ).toBe(false);
  });

  it('rejects when nextFocus contains non-strings', () => {
    expect(isWeeklyAnalysis({ ...validAnalysis, nextFocus: [null] })).toBe(false);
  });

  it('rejects primitives and null', () => {
    expect(isWeeklyAnalysis(null)).toBe(false);
    expect(isWeeklyAnalysis('hi')).toBe(false);
    expect(isWeeklyAnalysis(42)).toBe(false);
  });

  it('accepts empty arrays — the AI may legitimately have nothing to say in a category', () => {
    expect(
      isWeeklyAnalysis({
        ...validAnalysis,
        patterns: [],
        kpt: { keep: [], problem: [], try: [] },
        nextFocus: [],
      }),
    ).toBe(true);
  });
});

describe('isWeeklyAnalysisResponse', () => {
  it('accepts a response with analysis + source', () => {
    expect(
      isWeeklyAnalysisResponse({
        analysis: validAnalysis,
        source: { dailyCount: 5 },
      }),
    ).toBe(true);
  });

  it('rejects when source.dailyCount is missing or wrong type', () => {
    expect(isWeeklyAnalysisResponse({ analysis: validAnalysis })).toBe(false);
    expect(
      isWeeklyAnalysisResponse({ analysis: validAnalysis, source: { dailyCount: '5' } }),
    ).toBe(false);
  });

  it('rejects when analysis itself is malformed', () => {
    expect(
      isWeeklyAnalysisResponse({
        analysis: { ...validAnalysis, summary: '' },
        source: { dailyCount: 0 },
      }),
    ).toBe(false);
  });
});
