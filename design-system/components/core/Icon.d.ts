import * as React from 'react';

export interface IconProps {
  /** Lucide icon name in kebab-case, e.g. "code-2", "bar-chart-3", "chevron-right". */
  name: string;
  /** Square px size. 14 for card eyebrows, 16 default, 18 for tiles, 24 for sidebar. */
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

export declare function Icon(props: IconProps): JSX.Element;
