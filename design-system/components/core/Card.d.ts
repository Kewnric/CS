import * as React from 'react';

/**
 * Library / browse card. The default variant carries a 135deg indigo-to-cyan
 * tint over the surface, an inset hairline highlight, and a 3px gradient bar
 * that fades in along the top edge on hover as the card lifts 3px.
 */
export interface CardProps {
  children?: React.ReactNode;
  /** default = tinted + hover lift; glass = frosted, for stat tiles over a gradient; flat = plain surface, no hover. */
  variant?: 'default' | 'glass' | 'flat';
  /** Force the hover/lift affordance on or off. Defaults to on for the default variant. */
  interactive?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

export declare function Card(props: CardProps): JSX.Element;
