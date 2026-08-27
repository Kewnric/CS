import * as React from 'react';

export interface DataTableColumn {
  key?: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  /** Custom cell renderer — return a Badge, ScoreBadge, TierBadge, etc. */
  render?: (row: any) => React.ReactNode;
}

/** Attempt-history table. Header is a surface-hover strip of 13px uppercase tertiary labels; rows separate on --border-color-subtle and wash on hover. The last row drops its border. */
export interface DataTableProps {
  columns?: DataTableColumn[];
  rows?: any[];
  onRowClick?: (row: any, index: number) => void;
  style?: React.CSSProperties;
}

export declare function DataTable(props: DataTableProps): JSX.Element;
