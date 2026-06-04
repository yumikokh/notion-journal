import { useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { FEELINGS } from '@/features/journal/draft';
import { useTheme } from '@/hooks/use-theme';

import { accentColor, scoreColor } from '../insights-colors';
import { FEELING_MAX, FEELING_MIN, type TrendPoint } from '../insights';

type FeelingTrendChartProps = {
  points: TrendPoint[];
};

const HEIGHT = 180;
const PAD_T = 16;
const PAD_B = 26; // room for the x-axis labels drawn inside the svg
const PAD_L = 34; // room for the y-axis feeling faces
const PAD_R = 12;

/**
 * Feeling trend line. The y-axis is the 1..5 feeling scale (saddest →
 * happiest); days without a feeling break the line rather than dropping it to
 * the floor. Each point is tinted by its value (green→red) and the line sits
 * over a soft accent gradient.
 */
export function FeelingTrendChart({ points }: FeelingTrendChartProps) {
  const theme = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const accent = accentColor(scheme);
  const [width, setWidth] = useState(0);

  const hasData = points.some((p) => p.score != null);
  const plotW = Math.max(0, width - PAD_L - PAD_R);
  const plotH = HEIGHT - PAD_T - PAD_B;

  const x = (i: number) =>
    points.length <= 1 ? PAD_L + plotW / 2 : PAD_L + (i / (points.length - 1)) * plotW;
  const y = (score: number) =>
    PAD_T + (1 - (score - FEELING_MIN) / (FEELING_MAX - FEELING_MIN)) * plotH;
  const baseY = y(FEELING_MIN);

  // Split into contiguous runs of recorded points so gaps break the line.
  const segments: { i: number; score: number }[][] = [];
  let run: { i: number; score: number }[] = [];
  points.forEach((p, i) => {
    if (p.score == null) {
      if (run.length) segments.push(run);
      run = [];
      return;
    }
    run.push({ i, score: p.score });
  });
  if (run.length) segments.push(run);

  const linePath = (seg: { i: number; score: number }[]) =>
    seg.map((pt, k) => `${k === 0 ? 'M' : 'L'}${x(pt.i).toFixed(1)},${y(pt.score).toFixed(1)}`).join(' ');
  const areaPath = (seg: { i: number; score: number }[]) =>
    `M${x(seg[0].i).toFixed(1)},${baseY.toFixed(1)} ` +
    seg.map((pt) => `L${x(pt.i).toFixed(1)},${y(pt.score).toFixed(1)}`).join(' ') +
    ` L${x(seg[seg.length - 1].i).toFixed(1)},${baseY.toFixed(1)} Z`;

  const bestFace = FEELINGS[0];
  const worstFace = FEELINGS[FEELINGS.length - 1];

  return (
    <View
      style={styles.container}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityLabel="Feeling 推移グラフ">
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          <Defs>
            <LinearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={accent} stopOpacity={0.22} />
              <Stop offset="1" stopColor={accent} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {/* horizontal guide lines: top, middle, bottom of the scale */}
          {[FEELING_MAX, (FEELING_MAX + FEELING_MIN) / 2, FEELING_MIN].map((s) => (
            <Line
              key={s}
              x1={PAD_L}
              y1={y(s)}
              x2={width - PAD_R}
              y2={y(s)}
              stroke={theme.backgroundSelected}
              strokeWidth={1}
            />
          ))}

          {/* y-axis feeling faces */}
          <SvgText x={4} y={y(FEELING_MAX) + 4} fontSize={13} fill={theme.textSecondary}>
            {bestFace}
          </SvgText>
          <SvgText x={4} y={y(FEELING_MIN) + 4} fontSize={13} fill={theme.textSecondary}>
            {worstFace}
          </SvgText>

          {hasData && (
            <>
              {segments.map((seg, s) =>
                seg.length >= 2 ? (
                  <Path key={`area-${s}`} d={areaPath(seg)} fill="url(#trendArea)" />
                ) : null,
              )}
              {segments.map((seg, s) =>
                seg.length >= 2 ? (
                  <Path
                    key={`line-${s}`}
                    d={linePath(seg)}
                    stroke={accent}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ) : null,
              )}
              {points.map((p, i) =>
                p.score == null ? null : (
                  <Circle
                    key={p.key}
                    cx={x(i)}
                    cy={y(p.score)}
                    r={4}
                    fill={scoreColor(p.score, scheme).text}
                    stroke={theme.background}
                    strokeWidth={1.5}
                  />
                ),
              )}
            </>
          )}

          {/* x-axis labels */}
          {points.map((p, i) => (
            <SvgText
              key={p.key}
              x={x(i)}
              y={HEIGHT - 8}
              fontSize={11}
              fill={theme.textSecondary}
              textAnchor="middle">
              {p.label}
            </SvgText>
          ))}
        </Svg>
      )}

      {width > 0 && !hasData && (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <ThemedText themeColor="textSecondary" type="small">
            この期間の記録がまだありません
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: HEIGHT,
    justifyContent: 'center',
  },
  emptyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
