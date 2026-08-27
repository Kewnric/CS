import * as React from 'react';

/** Nothing-here placeholder: a 64px circular glyph that floats on a 6s loop, a secondary-coloured title, and a tertiary line under it. */
export interface EmptyStateProps {
  /** Lucide name. */
  icon?: string;
  title?: string;
  description?: string;
  /** Optional Button. */
  action?: React.ReactNode;
  style?: React.CSSProperties;
}

export declare function EmptyState(props: EmptyStateProps): JSX.Element;
