import * as React from 'react';

/** Contribution grid. 14px cells, 4px radius, 4px gaps, 7 rows flowing by column. Intensity is indigo at 20/50/80/100% — level 4 also gets the primary glow. Scrolls horizontally with a hidden scrollbar. */
export interface HeatmapProps {
  /** Columns to render when data is omitted. */
  weeks?: number;
  /** Intensity per day, 0-4, column-major. */
  data?: number[];
  cell?: number;
  gap?: number;
  style?: React.CSSProperties;
}

export declare function Heatmap(props: HeatmapProps): JSX.Element;
