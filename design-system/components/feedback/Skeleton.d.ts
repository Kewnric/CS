import * as React from 'react';

/** Shimmer placeholder for an async surface. Surface-hover fill with a 1.4s white sweep at 8% opacity. */
export interface SkeletonProps {
  /** line = 14px bar; text = 0.8em inline bar; block = 96px panel. */
  variant?: 'line' | 'text' | 'block';
  width?: number | string;
  height?: number | string;
  style?: React.CSSProperties;
}

export declare function Skeleton(props: SkeletonProps): JSX.Element;
