import * as React from 'react';

/** Circular progress from the analytics tiles. Track is 10% white; the fill is round-capped, starts at 12 o'clock, and animates over 1s on the spring curve. */
export interface ProgressRingProps {
  /** 0-100. */
  value?: number;
  size?: number;
  stroke?: number;
  color?: string;
  showLabel?: boolean;
  style?: React.CSSProperties;
}

export declare function ProgressRing(props: ProgressRingProps): JSX.Element;
