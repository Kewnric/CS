import * as React from 'react';

/** Difficulty rank, S through E. Each tier is a fixed 135deg gradient with its own glow — gold S, red A, orange B, blue C, violet D, grey E. */
export interface TierBadgeProps {
  tier?: 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | string;
  /** Override the text. Defaults to the tier letter. */
  label?: string;
  style?: React.CSSProperties;
}

export declare function TierBadge(props: TierBadgeProps): JSX.Element;
