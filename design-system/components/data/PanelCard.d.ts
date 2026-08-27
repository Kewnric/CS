import * as React from 'react';

/**
 * Dashboard panel. The header is a 11px uppercase tertiary eyebrow with a 14px
 * glyph — never a real heading. surface = the home cards; glass = the analytics
 * command-centre panels (40%-surface fill, 16px blur, 2px hover lift).
 */
export interface PanelCardProps {
  /** Lucide name for the eyebrow. */
  icon?: string;
  /** Eyebrow text. Rendered uppercase. */
  title?: string;
  /** Right-aligned header slot — a count Badge or a small Button. */
  action?: React.ReactNode;
  children?: React.ReactNode;
  variant?: 'surface' | 'glass';
  style?: React.CSSProperties;
}

export declare function PanelCard(props: PanelCardProps): JSX.Element;
