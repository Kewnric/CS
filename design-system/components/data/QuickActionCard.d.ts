import * as React from 'react';

/** Shortcut row in the home Quick Actions list. 36px washed icon chip, 13px/700 label, 11px tertiary description. The icon wash cycles indigo, cyan, amber, green by position. */
export interface QuickActionCardProps {
  /** Lucide name. */
  icon: string;
  label: string;
  description?: string;
  /** Position in the list — drives the icon wash colour. */
  index?: number;
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

export declare function QuickActionCard(props: QuickActionCardProps): JSX.Element;
