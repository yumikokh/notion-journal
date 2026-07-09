import { describe, expect, it, jest } from '@jest/globals';
import type { ReactElement } from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { Colors } from '@/constants/theme';
import { FeelingPicker } from '@/features/journal/components/feeling-picker';
import { FEELINGS, FEELING_NOTION_COLORS } from '@/features/journal/draft';
import { notionChipColor } from '@/features/notion/colors';

// useColorScheme() returns null under jest; the component falls back to 'light',
// so every expected color is resolved with the light palette.
const SCHEME = 'light' as const;
const theme = Colors.light;

type Style = { backgroundColor?: string; color?: string; width?: number };
type HostNode = {
  type: string;
  props: { accessibilityLabel?: string; style?: Style | Style[] };
  children: (HostNode | string)[] | null;
};

/** Style may be a single object or an array; merge into one lookup. */
function flatStyle(style: Style | Style[] | undefined): Style {
  if (!style) return {};
  return Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
}

function render(ui: ReactElement): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(ui);
  });
  return renderer;
}

/** Flatten the host (toJSON) tree into a list of every element node. */
function allNodes(node: unknown, out: HostNode[] = []): HostNode[] {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    node.forEach((child) => allNodes(child, out));
    return out;
  }
  const n = node as HostNode;
  out.push(n);
  if (n.children) allNodes(n.children, out);
  return out;
}

/** Each stop is a Pressable (host View) whose child View is the tinted dot. */
function dotStyle(nodes: HostNode[], feeling: string): Style {
  const stop = nodes.find(
    (n) => n.type === 'View' && n.props.accessibilityLabel === `Feeling ${feeling}`,
  );
  const dot = (stop?.children ?? []).find(
    (c): c is HostNode => typeof c === 'object' && c.type === 'View',
  );
  return flatStyle(dot?.props.style);
}

/** The value chip is the Text showing the selected kaomoji (or the 気分 placeholder). */
function valueChipText(nodes: HostNode[]): HostNode | undefined {
  return nodes.find(
    (n) =>
      n.type === 'Text' &&
      typeof n.children?.[0] === 'string' &&
      (FEELINGS as readonly string[]).includes(n.children[0] as string),
  );
}

describe('FeelingPicker (gauge)', () => {
  it('renders one tappable stop per feeling', () => {
    const nodes = allNodes(render(<FeelingPicker value={null} onChange={jest.fn()} />).toJSON());
    for (const feeling of FEELINGS) {
      const stop = nodes.find(
        (n) => n.type === 'View' && n.props.accessibilityLabel === `Feeling ${feeling}`,
      );
      expect(stop).toBeDefined();
    }
  });

  it('tints every dot with its saturated Notion color even without a colorMap', () => {
    // Regression guards: options must not fall back to gray `default`, and
    // dots use the strong (text) end of the palette — the pale background
    // tint was invisible at dot size.
    const nodes = allNodes(render(<FeelingPicker value={null} onChange={jest.fn()} />).toJSON());
    for (const feeling of FEELINGS) {
      const chip = notionChipColor(FEELING_NOTION_COLORS[feeling], SCHEME);
      expect(dotStyle(nodes, feeling).backgroundColor).toBe(chip.text);
    }
  });

  it('grows the selected dot and shows its kaomoji in the value chip', () => {
    for (const selected of FEELINGS) {
      const chip = notionChipColor(FEELING_NOTION_COLORS[selected], SCHEME);
      const nodes = allNodes(
        render(<FeelingPicker value={selected} onChange={jest.fn()} />).toJSON(),
      );
      const selectedDot = dotStyle(nodes, selected);
      const otherDot = dotStyle(nodes, FEELINGS.find((f) => f !== selected)!);
      expect(selectedDot.width ?? 0).toBeGreaterThan(otherDot.width ?? 0);

      const chipText = valueChipText(nodes);
      expect(chipText?.children?.[0]).toBe(selected);
      expect(flatStyle(chipText?.props.style).color).toBe(chip.text);
    }
  });

  it('prefers the learned colorMap over the static fallback', () => {
    const selected = FEELINGS[0];
    const nodes = allNodes(
      render(
        <FeelingPicker value={selected} onChange={jest.fn()} colorMap={{ [selected]: 'green' }} />,
      ).toJSON(),
    );
    expect(dotStyle(nodes, selected).backgroundColor).toBe(notionChipColor('green', SCHEME).text);
  });

  it('shows the placeholder chip when nothing is selected', () => {
    const nodes = allNodes(render(<FeelingPicker value={null} onChange={jest.fn()} />).toJSON());
    expect(valueChipText(nodes)).toBeUndefined();
    const placeholder = nodes.find((n) => n.type === 'Text' && n.children?.[0] === '気分');
    expect(placeholder).toBeDefined();
    expect(flatStyle(placeholder?.props.style).color).toBe(theme.textSecondary);
  });

  it('emits the feeling on press, and null when the selected one is pressed again', () => {
    const onChange = jest.fn();

    const picked = render(<FeelingPicker value={null} onChange={onChange} />);
    act(() => {
      picked.root
        .find(
          (n) =>
            typeof n.props.onPress === 'function' &&
            n.props.accessibilityLabel === `Feeling ${FEELINGS[2]}`,
        )
        .props.onPress();
    });
    expect(onChange).toHaveBeenCalledWith(FEELINGS[2]);

    const reselect = render(<FeelingPicker value={FEELINGS[2]} onChange={onChange} />);
    act(() => {
      reselect.root
        .find(
          (n) =>
            typeof n.props.onPress === 'function' &&
            n.props.accessibilityLabel === `Feeling ${FEELINGS[2]}`,
        )
        .props.onPress();
    });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
