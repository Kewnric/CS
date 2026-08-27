import * as React from 'react';

/**
 * Row in the app's icon rail. 48px tall, 24px glyph, labels fade in when the
 * rail expands from 72px to 260px. The active row goes cyan with a 3px glowing
 * cyan rail on its left edge; hover nudges the row 3px right.
 */
export interface SidebarLinkProps {
  /** Lucide name. */
  icon: string;
  label: string;
  active?: boolean;
  /** Whether the rail is expanded (label visible). */
  expanded?: boolean;
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

export declare function SidebarLink(props: SidebarLinkProps): JSX.Element;
