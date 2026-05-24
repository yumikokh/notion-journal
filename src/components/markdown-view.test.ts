import { describe, expect, it } from '@jest/globals';

import { parseBlocks, parseInline, parseLine } from './markdown-view';

describe('parseLine (block-level)', () => {
  it('classifies headings 1/2/3', () => {
    expect(parseLine('# Title').type).toBe('h1');
    expect(parseLine('## Subtitle').type).toBe('h2');
    expect(parseLine('### Tertiary').type).toBe('h3');
  });

  it('treats `---` (and longer) as divider', () => {
    expect(parseLine('---').type).toBe('divider');
    expect(parseLine('-----').type).toBe('divider');
    expect(parseLine('___').type).toBe('divider');
  });

  it('parses bullet items with - or *', () => {
    expect(parseLine('- a')).toEqual({ type: 'bullet', text: 'a' });
    expect(parseLine('* b')).toEqual({ type: 'bullet', text: 'b' });
  });

  it('preserves the original number on ordered items', () => {
    expect(parseLine('3. third')).toEqual({ type: 'numbered', number: '3', text: 'third' });
  });

  it('parses task list items as checked or unchecked', () => {
    expect(parseLine('- [ ] todo')).toEqual({ type: 'task', checked: false, text: 'todo' });
    expect(parseLine('- [x] done')).toEqual({ type: 'task', checked: true, text: 'done' });
    expect(parseLine('- [X] done')).toEqual({ type: 'task', checked: true, text: 'done' });
  });

  it('parses block-level images', () => {
    expect(parseLine('![alt](https://x/y.png)')).toEqual({
      type: 'image',
      alt: 'alt',
      url: 'https://x/y.png',
    });
  });

  it('parses blockquotes', () => {
    expect(parseLine('> a quote')).toEqual({ type: 'quote', text: 'a quote' });
  });

  it('treats empty lines as blank', () => {
    expect(parseLine('').type).toBe('blank');
    expect(parseLine('   ').type).toBe('blank');
  });

  it('falls back to paragraph for normal text', () => {
    expect(parseLine('hello world')).toEqual({ type: 'paragraph', text: 'hello world' });
  });
});

describe('parseBlocks (multi-line)', () => {
  it('keeps a fenced code block together', () => {
    const blocks = parseBlocks('hi\n```ts\nconst x = 1;\nconst y = 2;\n```\nbye');
    expect(blocks).toEqual([
      { type: 'paragraph', text: 'hi' },
      { type: 'code', lang: 'ts', text: 'const x = 1;\nconst y = 2;' },
      { type: 'paragraph', text: 'bye' },
    ]);
  });

  it('handles an unclosed code fence by consuming to EOF', () => {
    const blocks = parseBlocks('```\nuh oh\nno close');
    expect(blocks).toEqual([{ type: 'code', text: 'uh oh\nno close' }]);
  });
});

describe('parseInline', () => {
  it('returns plain text when no markers present', () => {
    expect(parseInline('hello world')).toEqual([{ type: 'text', text: 'hello world' }]);
  });

  it('parses bold and italic', () => {
    expect(parseInline('a **b** c')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'bold', text: 'b' },
      { type: 'text', text: ' c' },
    ]);
    expect(parseInline('a *b* c')).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'italic', text: 'b' },
      { type: 'text', text: ' c' },
    ]);
  });

  it('parses inline code', () => {
    expect(parseInline('see `npm test` now')).toEqual([
      { type: 'text', text: 'see ' },
      { type: 'code', text: 'npm test' },
      { type: 'text', text: ' now' },
    ]);
  });

  it('parses links and images', () => {
    expect(parseInline('go to [home](https://x) please')).toEqual([
      { type: 'text', text: 'go to ' },
      { type: 'link', text: 'home', url: 'https://x' },
      { type: 'text', text: ' please' },
    ]);
    expect(parseInline('![p](https://x/p.png) caption')).toEqual([
      { type: 'image', alt: 'p', url: 'https://x/p.png' },
      { type: 'text', text: ' caption' },
    ]);
  });

  it('prefers image over link when both could match', () => {
    expect(parseInline('![p](u)')).toEqual([{ type: 'image', alt: 'p', url: 'u' }]);
  });

  it('parses strikethrough', () => {
    expect(parseInline('~~old~~ new')).toEqual([
      { type: 'strike', text: 'old' },
      { type: 'text', text: ' new' },
    ]);
  });

  it('linkifies a bare URL', () => {
    expect(parseInline('see https://example.com/path now')).toEqual([
      { type: 'text', text: 'see ' },
      { type: 'link', text: 'https://example.com/path', url: 'https://example.com/path' },
      { type: 'text', text: ' now' },
    ]);
  });

  it('strips trailing punctuation from bare URLs', () => {
    expect(parseInline('go to https://example.com.')).toEqual([
      { type: 'text', text: 'go to ' },
      { type: 'link', text: 'https://example.com', url: 'https://example.com' },
      { type: 'text', text: '.' },
    ]);
  });

  it('does not double-wrap an already-explicit link', () => {
    // `[label](https://x)` should win over the bare-URL matcher.
    expect(parseInline('[label](https://x)')).toEqual([
      { type: 'link', text: 'label', url: 'https://x' },
    ]);
  });
});

describe('Notion enhanced-markdown normalisation', () => {
  it('strips <empty-block/> and treats lines as blank', () => {
    const blocks = parseBlocks('<empty-block/>\n<empty-block/>\nhello');
    expect(blocks[blocks.length - 1]).toEqual({ type: 'paragraph', text: 'hello' });
    // empty-block lines become empty lines → blank blocks
    expect(blocks.slice(0, -1).every((b) => b.type === 'blank')).toBe(true);
  });

  it('converts <br> into real newlines', () => {
    const blocks = parseBlocks('first<br>second');
    expect(blocks).toEqual([
      { type: 'paragraph', text: 'first' },
      { type: 'paragraph', text: 'second' },
    ]);
  });

  it('replaces <unknown ...> with a clearly-marked placeholder', () => {
    const blocks = parseBlocks('<unknown type="bookmark" />');
    expect(blocks[0]).toEqual({ type: 'paragraph', text: '_[unsupported block]_' });
  });
});
