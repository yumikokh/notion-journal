import { describe, expect, it } from '@jest/globals';

import type { WeeklyAnalysis } from './weekly-analysis';
import {
  weeklyAnalysisToMarkdown,
  weeklyAnalysisToReflectionFields,
} from './weekly-analysis-notion';

const analysis: WeeklyAnalysis = {
  summary: '集中できた一週間。',
  patterns: ['朝型が続いた', '会議が多いと進捗が落ちる'],
  kpt: {
    keep: ['早寝早起き', '運動'],
    problem: ['夜更かし1回'],
    try: ['会議を午後に固める'],
  },
  nextFocus: ['機能Xを完成', '読書30分/日'],
};

const empty: WeeklyAnalysis = {
  summary: 's',
  patterns: [],
  kpt: { keep: [], problem: [], try: [] },
  nextFocus: [],
};

describe('weeklyAnalysisToMarkdown', () => {
  it('renders every on-screen section with headings and content', () => {
    const md = weeklyAnalysisToMarkdown(analysis, 5);
    expect(md).toContain('## サマリー');
    expect(md).toContain('5日分のジャーナルから');
    expect(md).toContain('集中できた一週間。');
    expect(md).toContain('## 気付き・パターン');
    expect(md).toContain('- 朝型が続いた');
    expect(md).toContain('## KPT');
    expect(md).toContain('**Keep**');
    expect(md).toContain('- 早寝早起き');
    expect(md).toContain('**Problem**');
    expect(md).toContain('- 夜更かし1回');
    expect(md).toContain('**Try**');
    expect(md).toContain('## 来週のフォーカス');
    expect(md).toContain('- 機能Xを完成');
  });

  it('falls back to （該当なし） for each empty list section', () => {
    const md = weeklyAnalysisToMarkdown(empty, 0);
    // patterns + keep + problem + try + nextFocus = 5 list sections
    expect(md.match(/（該当なし）/g)?.length).toBe(5);
  });
});

describe('weeklyAnalysisToReflectionFields', () => {
  it('maps KPT/nextFocus onto the four fields, newline-joined', () => {
    expect(weeklyAnalysisToReflectionFields(analysis)).toEqual({
      good: '早寝早起き\n運動',
      problem: '夜更かし1回',
      tryNext: '会議を午後に固める',
      nextGoal: '機能Xを完成\n読書30分/日',
    });
  });

  it('produces empty strings for empty lists (clears the cells)', () => {
    expect(weeklyAnalysisToReflectionFields(empty)).toEqual({
      good: '',
      problem: '',
      tryNext: '',
      nextGoal: '',
    });
  });
});
