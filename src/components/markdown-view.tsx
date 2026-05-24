import { Fragment, useEffect, useMemo, useState } from 'react';
import { Image, Linking, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type MarkdownViewProps = {
  children: string;
};

/**
 * Read-only Markdown renderer covering Notion-flavoured output.
 *
 * Block-level support:
 *   `# / ## / ###`     headings 1–3
 *   `- ` / `* `        bullet list
 *   `1. `              numbered list (preserves the original number)
 *   `- [ ]` / `- [x]`  task list
 *   `> `               blockquote
 *   `---`              horizontal divider
 *   ` ```lang … ``` `  fenced code block (multi-line)
 *   `![alt](url)`      block image (own line; aspect ratio fetched async)
 *   anything else      paragraph
 *
 * Inline support inside any text-bearing block:
 *   `**bold**` / `__bold__`
 *   `*italic*` / `_italic_`
 *   `~~strike~~`
 *   `` `code` ``
 *   `[label](url)`        tap → `Linking.openURL`
 *   `![alt](url)`         fallback: shows `[alt]` (use block-level form for actual rendering)
 */
export function MarkdownView({ children }: MarkdownViewProps) {
  const theme = useTheme();
  const blocks = useMemo(() => parseBlocks(children), [children]);

  return (
    <View>
      {blocks.map((block, i) => {
        const key = `${i}-${block.type}`;
        switch (block.type) {
          case 'blank':
            return <View key={key} style={styles.blank} />;
          case 'divider':
            return (
              <View
                key={key}
                style={[styles.divider, { backgroundColor: theme.textSecondary }]}
              />
            );
          case 'h1':
            return (
              <ThemedText key={key} style={styles.h1}>
                <InlineText tokens={parseInline(block.text)} />
              </ThemedText>
            );
          case 'h2':
            return (
              <ThemedText key={key} style={styles.h2}>
                <InlineText tokens={parseInline(block.text)} />
              </ThemedText>
            );
          case 'h3':
            return (
              <ThemedText key={key} style={styles.h3}>
                <InlineText tokens={parseInline(block.text)} />
              </ThemedText>
            );
          case 'quote':
            return (
              <View
                key={key}
                style={[styles.quote, { borderLeftColor: theme.textSecondary }]}>
                <ThemedText type="default" themeColor="textSecondary">
                  <InlineText tokens={parseInline(block.text)} />
                </ThemedText>
              </View>
            );
          case 'bullet':
            return (
              <View key={key} style={styles.listRow}>
                <ThemedText themeColor="textSecondary" style={styles.listMarker}>
                  •
                </ThemedText>
                <ThemedText type="default" style={styles.listText}>
                  <InlineText tokens={parseInline(block.text)} />
                </ThemedText>
              </View>
            );
          case 'numbered':
            return (
              <View key={key} style={styles.listRow}>
                <ThemedText themeColor="textSecondary" style={styles.listMarker}>
                  {block.number}.
                </ThemedText>
                <ThemedText type="default" style={styles.listText}>
                  <InlineText tokens={parseInline(block.text)} />
                </ThemedText>
              </View>
            );
          case 'task':
            return (
              <View key={key} style={styles.listRow}>
                <ThemedText themeColor="textSecondary" style={styles.listMarker}>
                  {block.checked ? '☑' : '☐'}
                </ThemedText>
                <ThemedText
                  type="default"
                  style={[
                    styles.listText,
                    block.checked && styles.taskChecked,
                  ]}>
                  <InlineText tokens={parseInline(block.text)} />
                </ThemedText>
              </View>
            );
          case 'image':
            return <MarkdownImage key={key} url={block.url} alt={block.alt} />;
          case 'code':
            return (
              <View
                key={key}
                style={[styles.code, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="default" style={styles.codeText}>
                  {block.text}
                </ThemedText>
              </View>
            );
          case 'paragraph':
            return (
              <ThemedText key={key} type="default" style={styles.paragraph}>
                <InlineText tokens={parseInline(block.text)} />
              </ThemedText>
            );
          default:
            return <Fragment key={key} />;
        }
      })}
    </View>
  );
}

// ---- Block parsing --------------------------------------------------------

export type Block =
  | { type: 'h1' | 'h2' | 'h3'; text: string }
  | { type: 'paragraph' | 'quote' | 'bullet'; text: string }
  | { type: 'numbered'; number: string; text: string }
  | { type: 'task'; checked: boolean; text: string }
  | { type: 'image'; alt: string; url: string }
  | { type: 'code'; lang?: string; text: string }
  | { type: 'divider' }
  | { type: 'blank' };

/**
 * Strip / normalise the HTML-ish markers Notion emits in its enhanced
 * markdown output:
 *   `<empty-block/>` — placeholder for an empty Notion block; render as blank.
 *   `<br>` / `<br/>` — soft line break inside a block; convert to newline.
 *   `<unknown ...>`  — unsupported block (bookmark/embed/etc.); replace with a marker.
 */
function normaliseNotionMarkdown(md: string): string {
  return md
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<empty-block\s*\/?>/gi, '')
    .replace(/<unknown[^>]*\/?>/gi, '_[unsupported block]_');
}

export function parseBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = normaliseNotionMarkdown(md).split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trimEnd();

    // Fenced code block (multi-line)
    const fence = /^```\s*(\w*)\s*$/.exec(line);
    if (fence) {
      const lang = fence[1] || undefined;
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i].trimEnd())) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence (or EOF)
      blocks.push({ type: 'code', lang, text: buf.join('\n') });
      continue;
    }

    blocks.push(parseLine(line));
    i++;
  }
  return blocks;
}

export function parseLine(raw: string): Block {
  const t = raw.trimEnd();
  if (t.length === 0) return { type: 'blank' };
  if (/^(-{3,}|_{3,}|\*{3,})$/.test(t)) return { type: 'divider' };

  // Block image: image syntax alone on the line.
  let m = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/.exec(t);
  if (m) return { type: 'image', alt: m[1], url: m[2] };

  m = /^### (.+)$/.exec(t);
  if (m) return { type: 'h3', text: m[1] };
  m = /^## (.+)$/.exec(t);
  if (m) return { type: 'h2', text: m[1] };
  m = /^# (.+)$/.exec(t);
  if (m) return { type: 'h1', text: m[1] };

  m = /^> (.+)$/.exec(t);
  if (m) return { type: 'quote', text: m[1] };

  // Task before bullet (longer-prefix match wins).
  m = /^[-*] \[([ xX])\] (.+)$/.exec(t);
  if (m) return { type: 'task', checked: m[1] !== ' ', text: m[2] };

  m = /^[-*] (.+)$/.exec(t);
  if (m) return { type: 'bullet', text: m[1] };

  m = /^(\d+)\. (.+)$/.exec(t);
  if (m) return { type: 'numbered', number: m[1], text: m[2] };

  return { type: 'paragraph', text: t };
}

// ---- Inline parsing -------------------------------------------------------

export type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'bold' | 'italic' | 'strike' | 'code'; text: string }
  | { type: 'link'; text: string; url: string }
  | { type: 'image'; alt: string; url: string };

type InlineMatcher = {
  re: RegExp;
  build: (match: RegExpExecArray) => InlineToken;
};

// Order matters where ambiguity exists. Explicit markdown forms (image,
// link, bold, …) are tried first; the bare-URL matcher is the fallback
// so it never eats a URL already wrapped in `[](…)`.
const INLINE_MATCHERS: InlineMatcher[] = [
  { re: /!\[([^\]]*)\]\(([^)]+)\)/, build: (m) => ({ type: 'image', alt: m[1], url: m[2] }) },
  { re: /\[([^\]]+)\]\(([^)]+)\)/, build: (m) => ({ type: 'link', text: m[1], url: m[2] }) },
  { re: /\*\*([^*]+)\*\*/, build: (m) => ({ type: 'bold', text: m[1] }) },
  { re: /__([^_]+)__/, build: (m) => ({ type: 'bold', text: m[1] }) },
  { re: /(?<![*])\*([^*\n]+)\*(?!\*)/, build: (m) => ({ type: 'italic', text: m[1] }) },
  { re: /(?<![_\w])_([^_\n]+)_(?![_\w])/, build: (m) => ({ type: 'italic', text: m[1] }) },
  { re: /~~([^~]+)~~/, build: (m) => ({ type: 'strike', text: m[1] }) },
  { re: /`([^`]+)`/, build: (m) => ({ type: 'code', text: m[1] }) },
  // Bare URL — last so explicit `[text](url)` syntax wins.
  { re: /https?:\/\/[^\s<>\[\]"'`]+/, build: bareUrlToken },
];

/**
 * Build a link token from a bare URL match, stripping common trailing
 * punctuation (period, comma, paren, bracket, etc.) so a URL at the end
 * of a sentence renders cleanly.
 */
function bareUrlToken(m: RegExpExecArray): InlineToken {
  let url = m[0];
  const trailing = /[.,;:!?)\]\}]+$/.exec(url);
  if (trailing) url = url.slice(0, -trailing[0].length);
  return { type: 'link', text: url, url };
}

export function parseInline(text: string): InlineToken[] {
  const out: InlineToken[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    let best: { start: number; end: number; token: InlineToken } | null = null;
    for (const { re, build } of INLINE_MATCHERS) {
      const m = re.exec(remaining);
      if (m && (best === null || m.index < best.start)) {
        const token = build(m);
        // For a bare URL we may have trimmed trailing punctuation —
        // shrink `end` to match the actual consumed length.
        let end = m.index + m[0].length;
        if (token.type === 'link' && token.text === token.url) {
          end = m.index + token.url.length;
        }
        best = { start: m.index, end, token };
      }
    }
    if (!best) {
      out.push({ type: 'text', text: remaining });
      break;
    }
    if (best.start > 0) {
      out.push({ type: 'text', text: remaining.slice(0, best.start) });
    }
    out.push(best.token);
    remaining = remaining.slice(best.end);
  }
  return out;
}

// ---- Inline renderer ------------------------------------------------------

function InlineText({ tokens }: { tokens: InlineToken[] }) {
  const theme = useTheme();
  return (
    <>
      {tokens.map((tok, i) => {
        switch (tok.type) {
          case 'text':
            return <Fragment key={i}>{tok.text}</Fragment>;
          case 'bold':
            return (
              <ThemedText key={i} style={styles.bold}>
                {tok.text}
              </ThemedText>
            );
          case 'italic':
            return (
              <ThemedText key={i} style={styles.italic}>
                {tok.text}
              </ThemedText>
            );
          case 'strike':
            return (
              <ThemedText key={i} style={styles.strike}>
                {tok.text}
              </ThemedText>
            );
          case 'code':
            return (
              <ThemedText
                key={i}
                style={[
                  styles.inlineCode,
                  { backgroundColor: theme.backgroundSelected, color: theme.text },
                ]}>
                {tok.text}
              </ThemedText>
            );
          case 'link':
            return (
              <ThemedText
                key={i}
                style={styles.link}
                onPress={() => Linking.openURL(tok.url).catch(() => undefined)}>
                {tok.text}
              </ThemedText>
            );
          case 'image':
            // RN can't reliably embed Image inside Text. Fall back to bracketed alt.
            return <Fragment key={i}>{tok.alt ? `[${tok.alt}]` : '[image]'}</Fragment>;
          default:
            return <Fragment key={i} />;
        }
      })}
    </>
  );
}

// ---- Image block ----------------------------------------------------------

function MarkdownImage({ url, alt }: { url: string; alt: string }) {
  const [aspect, setAspect] = useState<number>(16 / 9);

  useEffect(() => {
    let cancelled = false;
    Image.getSize(
      url,
      (w, h) => {
        if (!cancelled && w > 0 && h > 0) setAspect(w / h);
      },
      () => {
        // dimensions unavailable; keep the default aspect
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <Image
      source={{ uri: url }}
      accessibilityLabel={alt || 'image'}
      style={[styles.image, { aspectRatio: aspect }]}
      resizeMode="contain"
    />
  );
}

// ---- Styles ---------------------------------------------------------------

const styles = StyleSheet.create({
  blank: {
    height: Spacing.two,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.three,
    opacity: 0.3,
  },
  h1: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  h2: {
    fontSize: 19,
    lineHeight: 26,
    fontWeight: '700',
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  h3: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },
  paragraph: {
    marginVertical: 2,
  },
  quote: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.two,
    marginVertical: Spacing.one,
  },
  listRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    marginVertical: 1,
  },
  listMarker: {
    minWidth: 22,
    fontSize: 16,
    lineHeight: 24,
  },
  listText: {
    flex: 1,
  },
  taskChecked: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  code: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginVertical: Spacing.one,
  },
  codeText: {
    fontFamily: 'ui-monospace',
    fontSize: 14,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  strike: {
    textDecorationLine: 'line-through',
  },
  inlineCode: {
    fontFamily: 'ui-monospace',
    fontSize: 14,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  link: {
    color: '#4477cc',
    textDecorationLine: 'underline',
  },
  image: {
    width: '100%',
    maxWidth: 480,
    maxHeight: 280,
    alignSelf: 'flex-start',
    borderRadius: Spacing.two,
    marginVertical: Spacing.one,
  },
});
