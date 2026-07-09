import { describe, expect, it, jest } from '@jest/globals';
import type { ReactElement } from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { Colors } from '@/constants/theme';
import { FEELINGS, FEELING_NOTION_COLORS } from '@/features/journal/draft';
import { notionChipColor } from '@/features/notion/colors';

// The native SwiftUI Slider can't render under jest — stub it with a probe
// that exposes its props for the tests to drive.
jest.mock('@expo/ui/swift-ui', () => ({
  Slider: () => null,
  Host: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  tint: (color: string) => ({ $type: 'tint', color }),
}));

// eslint-disable-next-line import/first -- must come after the mocks
import { FeelingPicker } from '@/features/journal/components/feeling-picker';

const SCHEME = 'light' as const;
const theme = Colors.light;

function render(ui: ReactElement): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(ui);
  });
  return renderer;
}

/** The mocked Slider instance (found by its function name). */
function sliderProps(renderer: ReactTestRenderer) {
  return renderer.root.find((n) => (n.type as { name?: string }).name === 'Slider').props as {
    value: number;
    onValueChange: (v: number) => void;
    onEditingChanged: (editing: boolean) => void;
    modifiers: { $type: string; color: string }[];
  };
}

describe('FeelingPicker (system slider)', () => {
  it('commits the nearest feeling only when the drag ends', () => {
    const onChange = jest.fn();
    const r = render(<FeelingPicker value={null} onChange={onChange} />);

    act(() => sliderProps(r).onValueChange(3.4));
    expect(onChange).not.toHaveBeenCalled();

    act(() => sliderProps(r).onEditingChanged(false));
    expect(onChange).toHaveBeenCalledWith(FEELINGS[3]);
  });

  it('previews the dragged feeling in the value chip before commit', () => {
    const r = render(<FeelingPicker value={null} onChange={jest.fn()} />);
    act(() => sliderProps(r).onValueChange(0));
    expect(JSON.stringify(r.toJSON())).toContain(FEELINGS[0]);
  });

  it('shows the placeholder when nothing is selected and clears on chip tap only when set', () => {
    const onChange = jest.fn();
    const empty = render(<FeelingPicker value={null} onChange={onChange} />);
    expect(JSON.stringify(empty.toJSON())).toContain('気分');
    act(() =>
      empty.root
        .find((n) => n.props.accessibilityLabel === '気分' && typeof n.props.onPress === 'function')
        .props.onPress(),
    );
    expect(onChange).not.toHaveBeenCalled();

    const set = render(<FeelingPicker value={FEELINGS[1]} onChange={onChange} />);
    act(() =>
      set.root
        .find(
          (n) =>
            n.props.accessibilityLabel === '気分をクリア' &&
            typeof n.props.onPress === 'function',
        )
        .props.onPress(),
    );
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('tints the slider and chip with the Notion color, preferring the learned colorMap', () => {
    const selected = FEELINGS[0];
    const fallback = render(<FeelingPicker value={selected} onChange={jest.fn()} />);
    const fallbackChip = notionChipColor(FEELING_NOTION_COLORS[selected], SCHEME);
    expect(sliderProps(fallback).modifiers[0].color).toBe(fallbackChip.text);

    const learned = render(
      <FeelingPicker value={selected} onChange={jest.fn()} colorMap={{ [selected]: 'green' }} />,
    );
    expect(sliderProps(learned).modifiers[0].color).toBe(notionChipColor('green', SCHEME).text);
  });

  it('uses the neutral accent tint when nothing is selected', () => {
    const r = render(<FeelingPicker value={null} onChange={jest.fn()} />);
    expect(sliderProps(r).modifiers[0].color).toBe(theme.accent);
    expect(sliderProps(r).value).toBe(2);
  });
});
