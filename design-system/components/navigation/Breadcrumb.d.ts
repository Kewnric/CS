import * as React from 'react';

/** Folder trail above a library pane. Ancestors are clickable 600-weight buttons; the current node is 700 and primary-coloured. Separator is a 12px chevron-right. */
export interface BreadcrumbProps {
  /** Strings, or objects with a label. */
  items?: Array<string | { label: string }>;
  onNavigate?: (index: number) => void;
  style?: React.CSSProperties;
}

export declare function Breadcrumb(props: BreadcrumbProps): JSX.Element;
