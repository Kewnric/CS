import * as React from 'react';

/** Status pill — 11px/700, fully rounded, tinted background with a matching hairline border. */
export interface BadgeProps {
  children?: React.ReactNode;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  style?: React.CSSProperties;
}

export declare function Badge(props: BadgeProps): JSX.Element;
