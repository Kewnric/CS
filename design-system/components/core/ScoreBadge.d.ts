import * as React from 'react';

/** Attempt score. Green when the attempt was perfect, amber otherwise — the app's only two score states. */
export interface ScoreBadgeProps {
  children?: React.ReactNode;
  perfect?: boolean;
  style?: React.CSSProperties;
}

export declare function ScoreBadge(props: ScoreBadgeProps): JSX.Element;
