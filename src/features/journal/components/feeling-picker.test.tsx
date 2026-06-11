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

type Style = { backgroundColor?: string; color?: string };
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

/** The tinted background lives on the Pressable's host View (style flattened). */
function buttonBackground(nodes: HostNode[], feeling: string): string | undefined {
  const view = nodes.find(
    (n) => n.type === 'View' && n.props.accessibilityLabel === `Feeling ${feeling}`,
  );
  return flatStyle(view?.props.style).backgroundColor;
}

/** The face color lives on the innermost Text whose only child is the glyph. */
function faceColor(nodes: HostNode[], feeling: string): string | undefined {
  const text = nodes.find((n) => n.type === 'Text' && n.children?.[0] === feeling);
  return flatStyle(text?.props.style).color;
}

describe('FeelingPicker', () => {
  it('renders one button per feeling', () => {
    const nodes = allNodes(render(<FeelingPicker value={null} onChange={jest.fn()} />).toJSON());
    for (const feeling of FEELINGS) {
      const view = nodes.find(
        (n) => n.type === 'View' && n.props.accessibilityLabel === `Feeling ${feeling}`,
      );
      expect(view).toBeDefined();
    }
  });

  it('keeps unselected faces in the secondary text color', () => {
    const nodes = allNodes(render(<FeelingPicker value={null} onChange={jest.fn()} />).toJSON());
    for (const feeling of FEELINGS) {
      expect(faceColor(nodes, feeling)).toBe(theme.textSecondary);
    }
  });

  it('tints the selected face with its Notion color, falling back to the static map', () => {
    // No colorMap → every feeling must still use its known Notion color when
    // selected (the regression: previously these fell back to gray `default`).
    for (const selected of FEELINGS) {
      const chip = notionChipColor(FEELING_NOTION_COLORS[selected], SCHEME);
      const nodes = allNodes(
        render(<FeelingPicker value={selected} onChange={jest.fn()} />).toJSON(),
      );
      expect(buttonBackground(nodes, selected)).toBe(chip.background);
      expect(faceColor(nodes, selected)).toBe(chip.text);
    }
  });

  it('prefers the learned colorMap over the static fallback', () => {
    const selected = FEELINGS[0];
    const nodes = allNodes(
      render(
        <FeelingPicker value={selected} onChange={jest.fn()} colorMap={{ [selected]: 'green' }} />,
      ).toJSON(),
    );
    expect(buttonBackground(nodes, selected)).toBe(notionChipColor('green', SCHEME).background);
  });

  it('paints the tinted background only on the selected face', () => {
    const selected = FEELINGS[0];
    const nodes = allNodes(render(<FeelingPicker value={selected} onChange={jest.fn()} />).toJSON());

    expect(buttonBackground(nodes, selected)).toBe(
      notionChipColor(FEELING_NOTION_COLORS[selected], SCHEME).background,
    );
    expect(buttonBackground(nodes, FEELINGS[1])).toBe(theme.backgroundElement);
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
